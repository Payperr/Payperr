import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, ROOT } from '../server/app.mjs';
import { strong, fakeMarket, clock, testConfig } from './helpers.mjs';

function req(port, method, p, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { host: `127.0.0.1:${port}`, ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
      let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch {} resolve({ status: res.statusCode, headers: res.headers, body: b, json: j }); });
    }); r.on('error', reject); if (data) r.write(data); r.end();
  });
}

async function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swp srv ')); const c = clock(); const cfg = testConfig({ port: 18787 });
  const app = createApp({ cfg, market: fakeMarket(() => [strong()], c), stateFile: path.join(dir, 'state.json'), now: c.now, log: () => {}, autoTick: false });
  const port = await app.listen(0); return { app, port, c };
}

test('API endpoints, schemas and SSE events', async () => {
  const { app, port, c } = await boot();
  try {
    // SSE: connect first, then trigger ticks and collect named events
    const events = []; const sse = await new Promise((resolve) => {
      const r = http.get({ host: '127.0.0.1', port, path: '/api/stream', headers: { host: `127.0.0.1:${port}` } }, (res) => {
        assert.equal(res.headers['content-type'], 'text/event-stream; charset=utf-8');
        let buf = ''; res.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n\n')) >= 0) { const chunk = buf.slice(0, i); buf = buf.slice(i + 2); const ev = /event: (\w+)/.exec(chunk)?.[1]; const data = /data: (.*)/.exec(chunk)?.[1]; if (ev) events.push([ev, JSON.parse(data)]); } });
        resolve(r);
      });
    });
    await new Promise((r) => setTimeout(r, 50));
    c.advance(30000); await app.engine.tick(); c.advance(30000); await app.engine.tick();
    await new Promise((r) => setTimeout(r, 100)); sse.destroy();
    const names = new Set(events.map((e) => e[0]));
    for (const k of ['hello', 'check', 'prop', 'tick', 'quorum', 'trade', 'status']) assert.ok(names.has(k), 'SSE event ' + k);
    assert.equal(events[0][0], 'hello'); assert.equal(events[0][1].paper, true);

    const st = (await req(port, 'GET', '/api/status')).json;
    assert.equal(st.paper, true); assert.equal(st.realExecution, false); assert.equal(st.account.label, 'PAPER · virtual USD');
    for (const k of ['cash', 'equity', 'exposureUsd', 'unrealizedUsd', 'realizedUsd', 'feesUsd', 'pnlUsd']) assert.equal(typeof st.account[k], 'number', k);
    assert.ok(['live', 'degraded', 'stale', 'down', 'starting'].includes(st.feed.state)); assert.equal(typeof st.feed.lastOkAt, 'number');
    const ag = (await req(port, 'GET', '/api/agents')).json.rows; assert.ok(ag.length >= 10); for (const a of ag) for (const k of ['key', 'fam', 'lin', 'rule', 'votes', 'quorums']) assert.ok(k in a, k);
    const qs = (await req(port, 'GET', '/api/quorums?n=5')).json.rows; assert.ok(qs.length >= 1);
    const q1 = (await req(port, 'GET', '/api/quorum/' + qs.at(-1).id)).json; for (const k of ['id', 'at', 'sym', 'mint', 'n', 'fams', 'lins', 'checks', 'voters', 'risk', 'state', 'observedAt', 'quoteAgeSec', 'source']) assert.ok(k in q1, k);
    assert.equal((await req(port, 'GET', '/api/quorum/nope')).status, 404);
    const led = (await req(port, 'GET', '/api/ledger')).json; assert.equal(led.paper, true); assert.ok(led.rows.some((r) => r.kind === 'buy'));
    const acct = (await req(port, 'GET', '/api/state')).json; assert.equal(acct.positions.length, 1); assert.equal(acct.positions[0].markStale, false); assert.match(acct.label, /PAPER/);
    const mk = (await req(port, 'GET', '/api/market')).json.rows; assert.equal(typeof mk[0].ageSec, 'number'); assert.ok('fetchedAt' in mk[0] && 'observedAt' in mk[0]);
    const fl = (await req(port, 'GET', '/api/fields')).json; assert.ok(fl.fields.chgH1); assert.ok(fl.unsupported.devHold);
    assert.equal((await req(port, 'GET', '/api/families')).json.rows.length, 6);

    // missing endpoints clearly unavailable (UI shows UNAVAILABLE)
    for (const p of ['/api/backtest', '/api/bots/all', '/api/chainbook', '/api/narratives', '/api/devhunt']) { const r = await req(port, 'GET', p); assert.equal(r.status, 404); assert.equal(r.json.error, 'unavailable'); assert.ok(r.json.reason); }
    // no fake explorer links or signatures anywhere in API output
    const all = [await req(port, 'GET', '/api/quorums'), await req(port, 'GET', '/api/ledger'), await req(port, 'GET', '/api/state')].map((r) => r.body).join('');
    assert.ok(!/solscan|explorer|"sig"|buySig|signature/i.test(all), 'no tx links/signatures for paper fills');

    // writes: custom agent, pause/resume, reset guard
    const bad = await req(port, 'POST', '/api/agents/custom', { body: { name: 'x', conditions: [{ field: 'holders', op: '>=', value: 1 }] } }); assert.equal(bad.status, 400); assert.match(bad.json.errors[0], /unsupported/);
    const ok = await req(port, 'POST', '/api/agents/custom', { body: { name: 'mine', conditions: [{ field: 'chgH1', op: '>=', value: 1 }] } }); assert.equal(ok.status, 200);
    assert.equal((await req(port, 'POST', `/api/agents/custom/${ok.json.agent.id}/stop`, { body: {} })).json.agent.enabled, false);
    assert.equal((await req(port, 'DELETE', `/api/agents/custom/${ok.json.agent.id}`)).status, 200);
    assert.equal((await req(port, 'POST', '/api/control/pause', { body: {} })).json.paused, true);
    assert.equal((await req(port, 'POST', '/api/control/resume', { body: {} })).json.paused, false);
    assert.equal((await req(port, 'POST', '/api/control/reset', { body: {} })).status, 400);
    assert.equal((await req(port, 'POST', '/api/me/wallet', { body: { wallet: 'x' } })).status, 410);
  } finally { await app.close(); }
});

test('security: loopback host check, same-origin writes, body limit, content type, traversal', async () => {
  const { app, port } = await boot();
  try {
    assert.equal((await req(port, 'GET', '/api/status', { headers: { host: 'evil.example:' + port } })).status, 421);
    assert.equal((await req(port, 'GET', '/api/status', { headers: { host: 'localhost:' + port } })).status, 200);
    assert.equal((await req(port, 'POST', '/api/control/pause', { body: {}, headers: { origin: 'https://evil.example' } })).status, 403);
    assert.equal((await req(port, 'POST', '/api/control/pause', { body: {}, headers: { origin: `http://127.0.0.1:${port}` } })).status, 200);
    assert.equal((await req(port, 'POST', '/api/control/pause', { body: 'x=1', headers: { 'content-type': 'text/plain' } })).status, 415);
    assert.equal((await req(port, 'POST', '/api/agents/custom', { body: { name: 'a'.repeat(20000) } })).status, 413);
    assert.equal((await req(port, 'POST', '/api/agents/custom', { body: '{bad json' })).status, 400);
    assert.equal((await req(port, 'POST', '/api/agents/custom', { body: '[1]' })).status, 400);
    for (const p of ['/../paper.config.json', '/%2e%2e/paper.config.json', '/..%2fserver%2fapp.mjs', '/%2e%2e%5cpaper.config.json']) { const r = await req(port, 'GET', p); assert.ok(!/"startingCashUsd"|createApp/.test(r.body), p); }
    const idx = await req(port, 'GET', '/'); assert.equal(idx.status, 200); assert.match(idx.headers['content-type'], /text\/html/); assert.match(idx.headers['content-security-policy'], /default-src 'self'/);
    assert.equal((await req(port, 'GET', '/agents')).status, 200, 'SPA route falls back to index.html');
    assert.equal((await req(port, 'GET', '/missing.js')).status, 404);
    assert.equal(app.server.address().address, '127.0.0.1');
  } finally { await app.close(); }
});

test('Windows path handling: ROOT comes from fileURLToPath, never URL.pathname', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server', 'app.mjs'), 'utf8');
  assert.match(src, /fileURLToPath\(import\.meta\.url\)/); assert.ok(!/new URL\(import\.meta\.url\)\.pathname/.test(src));
  assert.ok(fs.existsSync(path.join(ROOT, 'public', 'index.html')));
});

test('frontend has no simulator and no explorer-link code path for paper fills', () => {
  const pub = path.join(ROOT, 'public'); const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.(js|html)$/.test(f) && files.push(p); } }; walk(pub);
  const src = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  assert.ok(!fs.existsSync(path.join(pub, 'js', 'data.js')), 'simulator module removed');
  assert.ok(!/startSim|simAdapter/.test(src), 'no simulator code path');
  assert.ok(!/solscan|explorerTx|txUrl\(/.test(src), 'no explorer tx links');
  assert.ok(!/demoFallback|fallback:\s*'demo'/.test(src), 'no demo fallback');
});
