import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, validateAgent } from '../server/rules.mjs';
import { normalizePair, pickBestPairs, createMarket } from '../server/market.mjs';
import { buyFill, sellFill, exitDecision, slippageBps } from '../server/paper.mjs';
import { validateConfig, DEFAULTS } from '../server/config.mjs';
import { dayKey } from '../server/risk.mjs';
import { FAMILIES, BUILTIN_AGENTS } from '../server/strategies.mjs';
import { pair, A1, A2 } from './helpers.mjs';

const T = Date.UTC(2026, 10, 11, 4, 0, 0);
const snap = (o) => normalizePair(pair(A2, 'JUP', o), { fetchedAt: T, observedAt: T, endpoint: 'fixture' });

test('conditions: pass, fail and missing data (missing never passes)', () => {
  const s = snap({});
  assert.equal(evaluate([{ field: 'chgH1', op: '>=', value: 2 }], s).pass, true);
  assert.equal(evaluate([{ field: 'chgH1', op: '>=', value: 5 }], s).pass, false);
  const none = snap({ priceChange: null });
  const ev = evaluate([{ field: 'chgH1', op: '>=', value: -1000 }], none);
  assert.equal(ev.pass, false); assert.equal(ev.missing, 1); assert.equal(ev.results[0].ok, null); assert.equal(ev.results[0].v, 'missing');
  assert.equal(evaluate([], s).pass, false, 'an agent with no conditions never votes');
});

test('normalize: market cap is never replaced by FDV; inconsistent cap ignored; bad price flagged', () => {
  assert.equal(snap({ mc: null, fdv: 9e6 }).metrics.marketCap, null);
  assert.equal(snap({ mc: 9e9, fdv: 1e6 }).metrics.marketCap, null);
  assert.ok(snap({ mc: 9e9, fdv: 1e6 }).problems.some((p) => /marketCap/.test(p)));
  const z = snap({ price: 0 }); assert.equal(z.priceUsd, null); assert.ok(z.problems.includes('priceUsd not positive'));
  const n = snap({ price: 'abc' }); assert.equal(n.priceUsd, null);
  const s = snap({ b5: 30, s5: 10, volM5: 5000, volH1: 30000, created: T - 3600000 });
  assert.equal(s.metrics.buyShareM5, 0.75); assert.equal(s.metrics.volAccel, 2); assert.equal(Math.round(s.metrics.pairAgeMin), 60);
  assert.equal(snap({ created: T + 1e6 }).metrics.pairAgeMin, null, 'future pairCreatedAt is rejected');
  assert.equal(snap({ liq: null }).metrics.liqToMcap, null);
});

test('pickBestPairs: base-token match, solana only, highest liquidity', () => {
  const a = pair(A2, 'JUP', { liq: 1000, price: 1 }), b = pair(A2, 'JUP', { liq: 5000, price: 2 }), c = { ...pair(A2, 'JUP', { liq: 9e9 }), chainId: 'base' };
  const q = pair(A1, 'SOL', { liq: 9e9 }); q.quoteToken = { address: A2, symbol: 'JUP' }; // JUP as QUOTE token is ignored for JUP
  const m = pickBestPairs([a, b, c, q], [A2], { fetchedAt: T, observedAt: T, endpoint: 'x' });
  assert.equal(m.get(A2).priceUsd, 2); assert.equal(m.size, 1);
});

test('market client: observedAt = Date - Age, 429 backoff honours Retry-After, timeout', async () => {
  let now = T; const calls = [];
  const ok = (body, h = {}) => ({ ok: true, status: 200, headers: { get: (k) => h[k] ?? null }, json: async () => body });
  const fetchImpl = async (url) => { calls.push(url); return ok([pair(A2, 'JUP')], { date: new Date(T).toUTCString(), age: '12' }); };
  const m = createMarket({ fetchImpl, now: () => now });
  const r = await m.quotes([A2]); assert.equal(r.ok, true); assert.equal(r.snaps.get(A2).observedAt, T - 12000);
  assert.match(calls[0], /^https:\/\/api\.dexscreener\.com\/tokens\/v1\/solana\//);
  const m2 = createMarket({ fetchImpl: async () => ({ ok: false, status: 429, headers: { get: (k) => (k === 'retry-after' ? '40' : null) } }), now: () => now });
  assert.equal((await m2.quotes([A2])).ok, false); assert.equal(m2.state.rateLimited, 1);
  const r3 = await m2.quotes([A2]); assert.match(r3.errors[0], /backing off/); assert.equal(m2.state.requests, 1, 'no request sent during backoff');
  now += 41000; await m2.quotes([A2]); assert.equal(m2.state.requests, 2);
  const m3 = createMarket({ fetchImpl: (u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))), timeoutMs: 30 });
  const r4 = await m3.quotes([A2]); assert.match(r4.errors[0], /timeout/);
  // batches of at most 30 addresses
  const many = Array.from({ length: 31 }, (_, i) => A2.slice(0, -2) + String(10 + i)); const seen = [];
  const m4 = createMarket({ fetchImpl: async (u) => { seen.push(u.split('/').pop().split(',').length); return ok([]); } });
  await m4.quotes(many); assert.deepEqual(seen, [30, 1]);
});

test('paper fills: fees and slippage on buys and sells, impact term from liquidity', () => {
  const P = { ...DEFAULTS.paper, feeBps: 100, slippageBps: 150, flatFeeUsd: 0.5, priceImpactModel: true };
  assert.equal(slippageBps(P, 100, 1e6), 150); assert.equal(slippageBps(P, 10000, 100000), 2000);
  const b = buyFill(P, 100, 2, 1e6);
  assert.ok(Math.abs(b.fillPrice - 2.03) < 1e-12); assert.ok(Math.abs(b.feeUsd - (99.5 * 0.01 + 0.5)) < 1e-9);
  assert.ok(Math.abs(b.qty - (99.5 - 0.995) / 2.03) < 1e-9);
  const s = sellFill(P, b.qty, 2, 1e6); assert.ok(s.proceedsUsd < 100 * 0.96, 'round trip at an unchanged price loses fees + slippage');
  assert.equal(buyFill(P, 100, 0, 1e6), null); assert.equal(buyFill(P, 100, -1, 1e6), null); assert.equal(sellFill(P, 0, 1, 1), null);
});

test('exits: stop loss, take-profit ladder (partial), trailing stop, max hold', () => {
  const E = { takeProfit: [{ atPct: 8, sellPct: 50 }, { atPct: 16, sellPct: 50 }], stopLossPct: 6, trailingPct: 5, trailingArmPct: 6, maxHoldMinutes: 240 };
  const pos = { entryPrice: 1, peak: 1, qty: 100, qty0: 100, openedAt: T, tpDone: [false, false] };
  assert.match(exitDecision(E, pos, 0.93, T).reason, /stop loss/);
  const tp = exitDecision(E, pos, 1.09, T); assert.equal(tp.qty, 50); assert.deepEqual(tp.tpSteps, [0]);
  assert.equal(exitDecision(E, { ...pos, tpDone: [true, false], qty: 50 }, 1.10, T), null);
  assert.equal(exitDecision(E, { ...pos, qty: 100 }, 1.2, T).qty, 100, 'both steps at once sell everything');
  assert.match(exitDecision(E, { ...pos, peak: 1.07, tpDone: [true, false], qty: 50 }, 1.0165, T).reason, /trailing/);
  assert.equal(exitDecision(E, { ...pos, peak: 1.05 }, 0.99, T), null, 'trail not armed below +6 %');
  assert.match(exitDecision(E, pos, 1.01, T + 241 * 60000).reason, /max hold/);
  assert.equal(exitDecision(E, pos, NaN, T), null);
});

test('config validation rejects invalid and non-finite values with reasons', () => {
  const bad = validateConfig({ ...DEFAULTS, market: { ...DEFAULTS.market, watchlist: [{ address: 'nope' }] }, paper: { ...DEFAULTS.paper, feeBps: 'x', tradeSizeUsd: Infinity }, risk: { ...DEFAULTS.risk, dayTimeZone: 'Mars/Base' }, extra: 1 });
  assert.equal(bad.ok, false);
  for (const re of [/watchlist\[0\]/, /feeBps/, /tradeSizeUsd/, /dayTimeZone/, /Unknown setting "extra"/]) assert.ok(bad.errors.some((e) => re.test(e)), re);
  assert.equal(validateConfig({ ...DEFAULTS, market: { ...DEFAULTS.market, watchlist: [{ address: A1 }] } }).ok, true);
  assert.equal(validateConfig({ ...DEFAULTS, exits: { ...DEFAULTS.exits, takeProfit: [{ atPct: 5, sellPct: 80 }, { atPct: 9, sellPct: 40 }] }, market: { ...DEFAULTS.market, watchlist: [{ address: A1 }] } }).ok, false);
});

test('custom agent validation: unsupported fields rejected with reasons', () => {
  const r = validateAgent({ name: 'x', conditions: [{ field: 'devHold', op: '<=', value: 5 }], takeProfit: 2 });
  assert.equal(r.ok, false); assert.ok(r.errors.some((e) => /devHold.*not in the DexScreener feed/.test(e))); assert.ok(r.errors.some((e) => /takeProfit/.test(e)));
  assert.equal(validateAgent({ name: 'ok one', conditions: [{ field: 'chgH1', op: '>=', value: '2' }] }).agent.conditions[0].value, 2);
  assert.equal(validateAgent({ name: 'bad', conditions: [{ field: 'chgH1', op: '==', value: 1 }] }).ok, false);
  assert.equal(validateAgent({ name: 'bad', conditions: [{ field: 'chgH1', op: '>=', value: Infinity }] }).ok, false);
  assert.equal(validateAgent({ name: '<script>', conditions: [{ field: 'chgH1', op: '>=', value: 1 }] }).ok, false);
});

test('strategy set: small, distinct families, every rule reads a supported metric', async () => {
  const { FIELDS } = await import('../server/rules.mjs');
  assert.ok(BUILTIN_AGENTS.length <= 12);
  const fams = new Set(BUILTIN_AGENTS.map((a) => a.fam)); assert.ok(fams.size >= 5);
  for (const a of BUILTIN_AGENTS) { assert.ok(FAMILIES.find((f) => f.id === a.fam)); for (const c of a.conditions) assert.ok(FIELDS[c.field], c.field); }
  assert.equal(new Set(FAMILIES.map((f) => f.lineage)).size, FAMILIES.length, 'each family reads a different dimension');
});

test('day key follows the configured zone (Asia/Manila midnight = 16:00 UTC)', () => {
  assert.equal(dayKey(Date.UTC(2026, 10, 11, 15, 59), 'Asia/Manila'), '2026-11-11');
  assert.equal(dayKey(Date.UTC(2026, 10, 11, 16, 0), 'Asia/Manila'), '2026-11-12');
});

test('the shipped paper.config.json is valid and conservative', async () => {
  const { loadConfig } = await import('../server/config.mjs');
  const { ROOT } = await import('../server/app.mjs');
  const r = loadConfig((await import('node:path')).join(ROOT, 'paper.config.json'));
  assert.equal(r.ok, true, (r.errors || []).join('\n'));
  assert.ok(r.config.market.pollSeconds >= 30, 'poll no faster than the provider cache (30 s)');
  assert.ok(r.config.market.maxQuoteAgeSeconds <= 90);
  assert.ok(r.config.paper.feeBps > 0 && r.config.paper.slippageBps > 0, 'costs are never zero by default');
  assert.equal(r.config.risk.dayTimeZone, 'Asia/Manila');
});
