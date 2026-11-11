// Read-only DexScreener client (public, no API key). Documented limits (docs.dexscreener.com/api/reference):
//   /tokens/v1/{chainId}/{addresses}  up to 30 addresses, 300 requests/min
//   /token-boosts/latest/v1, /token-profiles/latest/v1   60 requests/min
// This client stays far below those: one batched quote call per poll (>= 30 s) and one
// discovery call every few minutes. It throttles per group, times out, and backs off on
// 429 (honouring Retry-After) and on 5xx / network errors. Nothing here can sign or send
// a transaction; it only performs HTTPS GETs.

export const API = 'https://api.dexscreener.com';
const GROUPS = { quotes: 250, lists: 1100 }; // minimum spacing between requests in ms
const UA = 'PayperPaper/1.0 (read-only paper-trading dashboard)';

const num = (v) => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null; };

// Turns one DexScreener pair object into the snapshot shape the engine uses.
export function normalizePair(p, { fetchedAt, observedAt, endpoint }) {
  const m5 = p?.txns?.m5 || {}, h1 = p?.txns?.h1 || {};
  const b5 = num(m5.buys), s5 = num(m5.sells), b1 = num(h1.buys), s1 = num(h1.sells);
  const t5 = b5 != null && s5 != null ? b5 + s5 : null, t1 = b1 != null && s1 != null ? b1 + s1 : null;
  const volM5 = num(p?.volume?.m5), volH1 = num(p?.volume?.h1);
  let marketCap = num(p?.marketCap); const fdv = num(p?.fdv);
  const problems = [];
  // Market cap is never replaced by FDV. If the feed's market cap is larger than its own FDV
  // (impossible by definition), we treat market cap as unknown instead of trusting it.
  if (marketCap != null && fdv != null && marketCap > fdv * 1.01) { problems.push(`marketCap ${marketCap} > fdv ${fdv}: market cap ignored as inconsistent`); marketCap = null; }
  if (marketCap != null && marketCap <= 0) marketCap = null;
  const created = num(p?.pairCreatedAt);
  const priceUsd = num(p?.priceUsd);
  if (priceUsd == null) problems.push('priceUsd missing'); else if (priceUsd <= 0) problems.push('priceUsd not positive');
  const liq = num(p?.liquidity?.usd); if (liq == null) problems.push('liquidity.usd missing');
  const metrics = {
    priceUsd: priceUsd != null && priceUsd > 0 ? priceUsd : null,
    liquidityUsd: liq, marketCap, fdv,
    chgM5: num(p?.priceChange?.m5), chgH1: num(p?.priceChange?.h1), chgH6: num(p?.priceChange?.h6), chgH24: num(p?.priceChange?.h24),
    volM5, volH1, volH6: num(p?.volume?.h6), volH24: num(p?.volume?.h24),
    txnsM5: t5, txnsH1: t1,
    buyShareM5: t5 ? b5 / t5 : null, buyShareH1: t1 ? b1 / t1 : null,
    volAccel: volM5 != null && volH1 > 0 ? (volM5 * 12) / volH1 : null,
    pairAgeMin: created != null && created > 0 && created <= fetchedAt ? (fetchedAt - created) / 60000 : null,
    liqToMcap: liq != null && marketCap > 0 ? liq / marketCap : null,
  };
  return {
    mint: p?.baseToken?.address, sym: String(p?.baseToken?.symbol || '?').slice(0, 16), name: String(p?.baseToken?.name || '').slice(0, 48),
    quoteSym: p?.quoteToken?.symbol || null, pairAddress: p?.pairAddress || null, dexId: p?.dexId || null,
    url: typeof p?.url === 'string' && p.url.startsWith('https://dexscreener.com/') ? p.url : null,
    priceUsd: metrics.priceUsd, metrics, problems, fetchedAt, observedAt, source: 'DexScreener ' + endpoint,
  };
}

// From all returned pairs, keep for each requested token the pair where it is the BASE token
// and liquidity.usd is highest (a token can trade in several pools).
export function pickBestPairs(pairs, addresses, meta) {
  const want = new Set(addresses); const best = new Map();
  for (const p of Array.isArray(pairs) ? pairs : []) {
    if (p?.chainId !== 'solana') continue; const a = p?.baseToken?.address; if (!want.has(a)) continue;
    const l = num(p?.liquidity?.usd) ?? -1; const cur = best.get(a);
    if (!cur || l > cur.l) best.set(a, { l, p });
  }
  const out = new Map(); for (const [a, { p }] of best) out.set(a, normalizePair(p, meta)); return out;
}

export function createMarket({ fetchImpl = globalThis.fetch, now = () => Date.now(), timeoutMs = 8000, log = () => {} } = {}) {
  const state = { quotes: { last: 0, backoffUntil: 0, fails: 0 }, lists: { last: 0, backoffUntil: 0, fails: 0 }, lastError: null, lastOkAt: null, requests: 0, rateLimited: 0 };
  async function get(path, group) {
    const g = state[group]; const t = now();
    if (t < g.backoffUntil) return { ok: false, error: `backing off until ${new Date(g.backoffUntil).toISOString()}`, backoff: true };
    const wait = g.last + GROUPS[group] - t; if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    g.last = now(); state.requests++;
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetchImpl(API + path, { headers: { accept: 'application/json', 'user-agent': UA }, signal: ac.signal });
      const fetchedAt = now();
      if (r.status === 429) {
        state.rateLimited++; g.fails++;
        const ra = num(r.headers?.get?.('retry-after')); g.backoffUntil = fetchedAt + Math.min(300000, ra != null ? ra * 1000 : 30000 * 2 ** Math.min(3, g.fails - 1));
        throw new Error('HTTP 429 rate limited');
      }
      if (!r.ok) { g.fails++; g.backoffUntil = fetchedAt + Math.min(120000, 5000 * 2 ** Math.min(5, g.fails - 1)); throw new Error('HTTP ' + r.status); }
      const data = await r.json();
      // When was this response actually produced? HTTP Date minus the CDN Age header, when present.
      const date = Date.parse(r.headers?.get?.('date') || ''); const age = num(r.headers?.get?.('age')) || 0;
      const observedAt = Number.isFinite(date) ? Math.min(fetchedAt, date - age * 1000) : fetchedAt;
      g.fails = 0; state.lastOkAt = fetchedAt; state.lastError = null;
      return { ok: true, data, fetchedAt, observedAt };
    } catch (e) {
      if (e.name === 'AbortError') { g.fails++; g.backoffUntil = now() + Math.min(120000, 5000 * 2 ** Math.min(5, g.fails - 1)); }
      else if (!/^HTTP/.test(e.message)) { g.fails++; g.backoffUntil = now() + Math.min(120000, 5000 * 2 ** Math.min(5, g.fails - 1)); }
      state.lastError = { at: now(), path, message: e.name === 'AbortError' ? `timeout after ${timeoutMs} ms` : e.message };
      log('market', `${path}: ${state.lastError.message}`);
      return { ok: false, error: state.lastError.message };
    } finally { clearTimeout(timer); }
  }
  return {
    state,
    // -> { ok, snaps: Map(address -> snapshot), errors: [] }
    async quotes(addresses) {
      const uniq = [...new Set(addresses)]; const snaps = new Map(); const errors = [];
      for (let i = 0; i < uniq.length; i += 30) {
        const chunk = uniq.slice(i, i + 30); const endpoint = '/tokens/v1/solana/{addresses}';
        const r = await get('/tokens/v1/solana/' + chunk.map(encodeURIComponent).join(','), 'quotes');
        if (!r.ok) { errors.push(r.error); continue; }
        for (const [a, s] of pickBestPairs(r.data, chunk, { fetchedAt: r.fetchedAt, observedAt: r.observedAt, endpoint })) snaps.set(a, s);
      }
      return { ok: errors.length === 0, snaps, errors };
    },
    // Newest Solana tokens from DexScreener's documented "latest" lists (boosted/profiled tokens:
    // these are paid promotions on DexScreener, NOT a quality signal; see README).
    async discover(sources, max) {
      const paths = { 'token-boosts-latest': '/token-boosts/latest/v1', 'token-profiles-latest': '/token-profiles/latest/v1' };
      const out = []; const errors = [];
      for (const s of sources) {
        const r = await get(paths[s], 'lists'); if (!r.ok) { errors.push(r.error); continue; }
        for (const x of Array.isArray(r.data) ? r.data : []) if (x?.chainId === 'solana' && typeof x.tokenAddress === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x.tokenAddress) && !out.includes(x.tokenAddress)) out.push(x.tokenAddress);
      }
      return { ok: errors.length === 0, addresses: out.slice(0, max), errors };
    },
  };
}
