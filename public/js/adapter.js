// =====================================================================================
//  Data adapter for the local paper-trading server (same origin only). The UI gets ALL
//  data from here. There is no simulator and no demo fallback: a section whose endpoint
//  fails or does not exist is marked UNAVAILABLE and stays empty.
//
//  A.sources: section -> 'live' (real market data) | 'paper' (virtual account data)
//                        | 'unavailable'
//  Sections: market quorums agents stream paper  (provided)
//            backtest holders chain metas devhunt lab  (not provided by this app)
// =====================================================================================
import { CFG } from './config.js';

export const PROVIDED = { market: '/api/market', quorums: '/api/quorums?n=300', agents: '/api/agents', paper: '/api/state' };
export const NOT_PROVIDED = { backtest: '/api/backtest', holders: '/api/bots/all', chain: '/api/chainbook', metas: '/api/narratives', devhunt: '/api/devhunt', lab: '/api/lab' };
const KIND = { market: 'live', quorums: 'live', agents: 'live', paper: 'paper', stream: 'live' };

async function getJson(path) {
  const r = await fetch(path, { headers: { accept: 'application/json' }, cache: 'no-store' });
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(j?.reason || j?.error || `${path} → HTTP ${r.status}`), { status: r.status, body: j });
  return j;
}
async function send(method, path, body) {
  try {
    const r = await fetch(path, { method, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: body == null ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); return r.ok ? { ok: true, ...j } : { ok: false, errors: j.errors || [j.reason || j.error || 'HTTP ' + r.status] };
  } catch (e) { return { ok: false, errors: ['The local server did not answer. Is the START window still open?'] }; }
}

export async function createAdapter() {
  const sources = { stream: 'unavailable', ...Object.fromEntries([...Object.keys(PROVIDED), ...Object.keys(NOT_PROVIDED)].map((k) => [k, 'unavailable'])) };
  const reasons = {};
  const pull = async (sec) => { try { const v = await getJson(PROVIDED[sec]); sources[sec] = KIND[sec]; delete reasons[sec]; return v; } catch (e) { sources[sec] = 'unavailable'; reasons[sec] = e.message; return null; } };
  // Ask once which sections exist and why the others don't, so pages can say so plainly.
  try { const cap = await getJson('/api/capabilities'); for (const sec of Object.keys(NOT_PROVIDED)) reasons[sec] = cap.unavailable?.[sec] || 'Not provided by this server.'; }
  catch (e) { for (const sec of Object.keys(NOT_PROVIDED)) reasons[sec] = 'The local server did not answer.'; }
  return {
    mode: 'live', sources, reasons, api: location.origin,
    async status() { try { return await getJson('/api/status'); } catch { return null; } },
    async fields() { try { return await getJson('/api/fields'); } catch { return null; } },
    async families() { try { return (await getJson('/api/families')).rows; } catch { return []; } },
    async load() {
      const [market, quorums, agents, paper, ledger] = await Promise.all([pull('market'), pull('quorums'), pull('agents'), pull('paper'), getJson('/api/ledger?n=2000').catch(() => null)]);
      if (!ledger) sources.paper = 'unavailable';
      return { MARKET: market?.rows || [], QUORUMS: quorums?.rows || [], AGENTS: agents?.rows || [], ACCOUNT: paper, LEDGER: ledger?.rows || [] };
    },
    subscribe(emit, onState) {
      let es; onState('connecting');
      es = new EventSource(CFG.data.streamPath);
      const up = () => { sources.stream = 'live'; onState('live'); };
      es.addEventListener('hello', (e) => { up(); try { emit('hello', JSON.parse(e.data)); } catch {} }); es.onopen = up;
      for (const k of ['prop', 'check', 'tick', 'quorum', 'trade', 'status', 'ledger']) es.addEventListener(k, (e) => { try { emit(k, JSON.parse(e.data)); } catch {} });
      es.onerror = () => { sources.stream = 'unavailable'; onState('reconnecting'); };   // EventSource retries by itself
      return () => es.close();
    },
    async fetchQuorum(id) { try { return await getJson('/api/quorum/' + encodeURIComponent(id)); } catch { return null; } },
    saveAgent: (a) => send('POST', '/api/agents/custom', a),
    agentAction: (id, action) => action === 'delete' ? send('DELETE', '/api/agents/custom/' + encodeURIComponent(id)) : send('POST', `/api/agents/custom/${encodeURIComponent(id)}/${action}`, {}),
    control: (what, body = {}) => send('POST', '/api/control/' + what, body),
  };
}
