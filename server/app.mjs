// HTTP layer: static files + JSON API + Server-Sent Events on ONE port.
// LOCAL mode (default, START.bat): binds 127.0.0.1 only, accepts only 127.0.0.1/localhost Host
// headers (DNS-rebinding guard), refuses cross-origin writes, keeps the private paper controls.
// PUBLIC mode (readOnly): exact trusted Host allow-list from PUBLIC_ORIGIN/TRUSTED_HOSTS and EVERY
// state-changing request is refused with 403 before its body is read: there is no admin login,
// no reset, no pause, no agent editing. Static files come only from /public. Body cap 16 KB, strict CSP.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from './engine.mjs';
import { loadJson, saveJson } from './store.mjs';
import { validState } from './engine.mjs';
import { FIELDS, UNSUPPORTED, OPS } from './rules.mjs';
import { pumpFunUrl } from './deploy.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const MAX_BODY = 16 * 1024;
const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'cross-origin-opener-policy': 'same-origin',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
// Sections of the template's data contract that this paper app does not provide.
const UNAVAILABLE = {
  '/api/backtest': 'No price history is recorded, so no backtest is computed and none is shown.',
  '/api/bots/all': 'Third-party holder agents are not connected to Payper.',
  '/api/chainbook': 'Paper trades create no on-chain transactions, so there is no chain record to show.',
  '/api/narratives': 'Theme and narrative tracking is not part of this version.',
  '/api/devhunt': 'Developer-wallet data is not available in the DexScreener feed.',
  '/api/lab': 'Automated strategy search is not part of this version.',
};

const SECTION = { '/api/backtest': 'backtest', '/api/bots/all': 'holders', '/api/chainbook': 'chain', '/api/narratives': 'metas', '/api/devhunt': 'devhunt', '/api/lab': 'lab' };

export const PROJECT = { name: 'Payper', ticker: 'PAYPER' };
const READ_ONLY_REASON = 'This public site is read-only: one shared paper account in virtual USD, not your wallet. To define your own agents, run Payper on your own computer.';

export function createApp({ cfg, market, stateFile, now = () => Date.now(), log = (...a) => console.log(...a), autoTick = true,
  readOnly = false, trustedHosts = null, bindHost = '127.0.0.1', publicOrigin = null, tokenMint = null, maxStreams = 20 }) {
  const loaded = stateFile ? loadJson(stateFile, validState) : { value: null, warnings: [] };
  for (const w of loaded.warnings) log('state', w);
  const clients = new Set();
  const send = (res, ev, data) => { try { res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} };
  const emit = (ev, data) => { for (const c of clients) send(c, ev, data); };
  let saveTimer = null; let dirty = false;
  const persist = () => { if (!stateFile) return; dirty = false; try { saveJson(stateFile, engine.state); } catch (e) { log('state', 'save failed: ' + e.message); } };
  const save = () => { dirty = true; if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = null; persist(); }, 250); };
  const engine = createEngine({ cfg, market, now, state: loaded.value, save, emit, log });
  const restored = !!loaded.value;

  // Exact Host allow-list. Public mode: the PUBLIC_ORIGIN host (+ TRUSTED_HOSTS); a TLS proxy must
  // forward the visitor's original Host header. X-Forwarded-* headers are never trusted for this.
  const trusted = trustedHosts ? new Set([...trustedHosts].map((h) => h.toLowerCase())) : null;
  const withDefaultPort = (h) => { const u = /^(.*?)(?::(\d+))?$/.exec(h); return u[2] === '443' || u[2] === '80' ? u[1] : h; };
  const allowedHosts = (port) => trusted ? new Set([...trusted].flatMap((h) => [h, withDefaultPort(h)])) : new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const project = () => ({ ...PROJECT, mode: readOnly ? 'public-read-only' : 'local', readOnly,
    sharedDemo: readOnly, paperOnly: true, realTrading: false, walletConnect: false,
    token: tokenMint
      ? { status: 'address-set', mint: tokenMint, pumpFunUrl: pumpFunUrl(tokenMint), check: 'Format checked only (Solana base58, 32 bytes). Not proof that this is the official PAYPER token: compare with the project\'s own announcement.' }
      : { status: 'not-launched', mint: null, pumpFunUrl: null, check: 'No token address is configured on this site.' },
    note: 'Payper today is a paper-trading desk on real market data with virtual money only. Real trading is not implemented. Holding a future PAYPER token is not promised to give any earnings, fees or share of anything.' });
  let boundPort = cfg.port;
  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEC }); res.end(JSON.stringify(body)); };
  const readBody = (req) => new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    let over = false;
    req.on('data', (c) => { if (over) return; n += c.length; if (n > MAX_BODY) { over = true; reject(Object.assign(new Error('Request body too large (max 16 KB).'), { code: 413 })); } else chunks.push(c); });
    req.on('end', () => { if (over) return; if (!n) return resolve({}); try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v); } catch { reject(Object.assign(new Error('Body is not valid JSON.'), { code: 400 })); } });
    req.on('error', reject);
  });
  const nInt = (v, d, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : d; };

  async function api(req, res, url) {
    const p = url.pathname; const m = req.method;
    if (m === 'GET') {
      if (p === '/api/status') return json(res, 200, { ...engine.status(), restored });
      if (p === '/api/project') return json(res, 200, project());
      if (p === '/api/capabilities') return json(res, 200, { paper: true, readOnly, provided: ['market', 'quorums', 'agents', 'paper', 'ledger', 'stream'], unavailable: Object.fromEntries(Object.entries(UNAVAILABLE).map(([k, v]) => [SECTION[k], v])) });
      if (p === '/api/families') return json(res, 200, { rows: engine.families() });
      if (p === '/api/agents') return json(res, 200, { rows: engine.agentRows() });
      if (p === '/api/quorums') return json(res, 200, { rows: engine.state.quorums.slice(0, nInt(url.searchParams.get('n'), 200, 600)) });
      if (p.startsWith('/api/quorum/')) { const q = engine.state.quorums.find((x) => x.id === decodeURIComponent(p.slice(12))); return q ? json(res, 200, q) : json(res, 404, { error: 'not found' }); }
      if (p === '/api/ledger') return json(res, 200, { paper: true, rows: engine.state.ledger.slice(0, nInt(url.searchParams.get('n'), 800, 5000)) });
      if (p === '/api/state' || p === '/api/account') return json(res, 200, { paper: true, label: 'PAPER · virtual USD · no real funds', account: engine.status().account, positions: engine.positions(), closed: engine.state.closed.slice(0, 200), pending: engine.state.pending, equity: engine.state.equityHist.slice(0, 600) });
      if (p === '/api/market') return json(res, 200, { provider: 'DexScreener', rows: engine.markets() });
      if (p === '/api/fields') return json(res, 200, { fields: FIELDS, ops: Object.keys(OPS), unsupported: UNSUPPORTED, slots: cfg.agents.customSlots });
      if (p === '/api/stream') {
        if (clients.size >= maxStreams) return json(res, 503, { error: 'too many open streams' });
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', ...SEC });
        res.write('retry: 3000\n\n'); clients.add(res); send(res, 'hello', { at: now(), paper: true, status: engine.status() });
        req.on('close', () => clients.delete(res)); return;
      }
      if (UNAVAILABLE[p]) return json(res, 404, { error: 'unavailable', reason: UNAVAILABLE[p] });
      return json(res, 404, { error: 'not found' });
    }
    if (readOnly) { res.setHeader('allow', 'GET, HEAD'); return json(res, 403, { error: 'read-only', reason: READ_ONLY_REASON }); }
    if (m === 'POST' || m === 'DELETE') {
      const origin = req.headers.origin;
      if (origin && !allowedHosts(boundPort).has(origin.replace(/^https?:\/\//, ''))) return json(res, 403, { error: 'cross-origin request refused' });
      if (m === 'POST' && !/^application\/json\b/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'send Content-Type: application/json' });
      let body; try { body = m === 'POST' ? await readBody(req) : {}; } catch (e) { if (e.code === 413) { res.setHeader('connection', 'close'); res.on('finish', () => setTimeout(() => req.destroy(), 100)); } return json(res, e.code || 400, { error: e.message }); }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) return json(res, 400, { error: 'Body must be a JSON object.' });
      const out = (r) => json(res, r.ok ? 200 : 400, r);
      if (m === 'POST' && (p === '/api/agents/custom' || p === '/api/me/agent')) return out(engine.saveCustom(body));
      let mm;
      if (m === 'POST' && (mm = p.match(/^\/api\/agents\/custom\/([\w.-]+)\/(start|stop)$/))) return out(engine.setCustomEnabled(mm[1], mm[2] === 'start'));
      if (m === 'DELETE' && (mm = p.match(/^\/api\/agents\/custom\/([\w.-]+)$/))) return out(engine.deleteCustom(mm[1]));
      if (m === 'POST' && p === '/api/control/pause') return out(engine.pause());
      if (m === 'POST' && p === '/api/control/resume') return out(engine.resume());
      if (m === 'POST' && p === '/api/control/reset') return out(engine.reset(body.confirm));
      if (m === 'POST' && p === '/api/me/wallet') return json(res, 410, { error: 'unavailable', reason: 'This paper app never asks for or stores wallet addresses, keys or funds.' });
      return json(res, 404, { error: 'not found' });
    }
    res.writeHead(405, { allow: 'GET, POST, DELETE', ...SEC }); res.end();
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SEC); return res.end(); }
    let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400, SEC); return res.end('Bad request'); }
    if (pathname.includes('\0')) { res.writeHead(400, SEC); return res.end('Bad request'); }
    let file = path.resolve(PUBLIC, '.' + pathname);
    const rel = path.relative(PUBLIC, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403, SEC); return res.end('Forbidden'); }
    let st = null; try { st = fs.statSync(file); } catch {}
    if (!st || st.isDirectory()) { if (path.extname(pathname)) { res.writeHead(404, { 'content-type': 'text/plain', ...SEC }); return res.end('Not found'); } file = path.join(PUBLIC, 'index.html'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache', ...SEC });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.end()).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    // Liveness probe for hosting platforms (their checkers often use an internal Host name).
    // Answers only "ok": no data, no state.
    if (req.url === '/healthz' && (req.method === 'GET' || req.method === 'HEAD')) { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store', ...SEC }); return res.end(req.method === 'HEAD' ? undefined : 'ok'); }
    const host = String(req.headers.host || '').toLowerCase();
    if (!allowedHosts(boundPort).has(trusted ? withDefaultPort(host) : host)) { res.writeHead(421, { 'content-type': 'text/plain', ...SEC }); return res.end(publicOrigin ? 'Misdirected request: open ' + publicOrigin + '/' : 'Misdirected request: open http://127.0.0.1:' + boundPort + '/'); }
    if (publicOrigin?.startsWith('https:')) res.setHeader('strict-transport-security', 'max-age=31536000');
    let url; try { url = new URL(req.url, 'http://127.0.0.1'); } catch { res.writeHead(400, SEC); return res.end(); }
    try { if (url.pathname.startsWith('/api/')) await api(req, res, url); else serveStatic(req, res, url); }
    catch (e) { log('http', e.stack || e.message); if (!res.headersSent) json(res, 500, { error: 'internal error' }); else res.end(); }
  });
  server.requestTimeout = 30000;
  let loop = null, hb = null;
  return {
    server, engine, restored, warnings: loaded.warnings,
    listen(port = cfg.port) {
      return new Promise((resolve, reject) => {
        const tryPort = (p, left) => {
          const onErr = (e) => { server.off('listening', onOk); if (e.code === 'EADDRINUSE' && left > 0) tryPort(p + 1, left - 1); else reject(e); };
          const onOk = () => { server.off('error', onErr); boundPort = server.address().port; resolve(boundPort); };
          server.once('error', onErr); server.once('listening', onOk); server.listen(p, bindHost);
        };
        tryPort(port, port === 0 || readOnly ? 0 : 10); // public mode never silently moves to another port
      }).then((p) => {
        if (autoTick) { const run = () => engine.tick().finally(() => { loop = setTimeout(run, cfg.market.pollSeconds * 1000); }); loop = setTimeout(run, 50); }
        hb = setInterval(() => { for (const c of clients) { try { c.write(': keep-alive\n\n'); } catch {} } }, 15000);
        return p;
      });
    },
    async close() { clearTimeout(loop); clearInterval(hb); clearTimeout(saveTimer); if (dirty || stateFile) persist(); for (const c of clients) { try { c.end(); } catch {} } clients.clear(); await new Promise((r) => server.close(() => r())); },
    get port() { return boundPort; },
  };
}
