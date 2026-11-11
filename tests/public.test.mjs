// PUBLIC READ-ONLY MODE + PAYPER CONTRACT ADDRESS. Fixture market only; nothing here touches a network,
// a wallet or a chain. Covers the settings in server/deploy.mjs and the guards in server/app.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, ROOT } from '../server/app.mjs';
import { resolveRuntime, checkContractAddress, base58Decode, pumpFunUrl } from '../server/deploy.mjs';
import { strong, fakeMarket, clock, testConfig, A1, A2, A3 } from './helpers.mjs';

const HOST = 'payper.example.com';
const MINT = A2; // a well-known existing mint used ONLY as a format fixture (not PAYPER)

function req(port, method, p, { body, headers = {}, host = HOST } = {}) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { host, ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
      let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch {} resolve({ status: res.statusCode, headers: res.headers, body: b, json: j }); });
    }); r.on('error', reject); if (data) r.write(data); r.end();
  });
}
async function bootPublic({ tokenMint = null, extraHosts = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'payper pub ')); const c = clock();
  const app = createApp({ cfg: testConfig({ port: 18790 }), market: fakeMarket(() => [strong()], c), stateFile: path.join(dir, 'state.json'), now: c.now, log: () => {}, autoTick: false,
    readOnly: true, trustedHosts: new Set([HOST, ...extraHosts]), bindHost: '127.0.0.1', publicOrigin: 'https://' + HOST, tokenMint, maxStreams: 5 });
  const port = await app.listen(0); return { app, port, c, dir };
}
const cfg = { port: 8787, contractAddress: '' };

test('contract address: empty means NOT LAUNCHED; only real 32-byte base58 Solana keys pass', () => {
  for (const v of ['', '   ', undefined, null]) assert.deepEqual(checkContractAddress(v), { ok: true, mint: null });
  for (const v of [A1, A2, A3, '11111111111111111111111111111111']) { const r = checkContractAddress(v); assert.ok(r.ok, v); assert.equal(r.mint, v); assert.equal(base58Decode(v).length, 32); }
  assert.equal(checkContractAddress('  ' + A2 + '\n').mint, A2, 'surrounding spaces are trimmed');
  const bad = ['<script>alert(1)</script>', 'https://pump.fun/coin/' + A2, A2 + '"onmouseover="x', 'javascript:alert(1)', '1'.repeat(43), 'z'.repeat(44), A2.slice(0, 30),
    A2.replace('J', '0'), A2.replace('J', 'O'), A2.replace('J', 'l'), A2 + ' ' + A3, 'PAYPER', 12345, { mint: A2 }];
  for (const v of bad) { const r = checkContractAddress(v); assert.equal(r.ok, false, String(v)); assert.ok(r.error.length > 20); assert.ok(!String(r.error).includes('<script'), 'errors never echo the pasted text'); }
  assert.match(checkContractAddress('https://pump.fun/coin/' + A2).error, /not a web link/);
  assert.equal(pumpFunUrl(A2), 'https://pump.fun/coin/' + A2);
});

test('runtime: local defaults stay private; public needs an exact https origin; TOKEN_MINT beats config', () => {
  const loc = resolveRuntime({}, cfg, ROOT);
  assert.deepEqual(loc.errors, []); assert.equal(loc.mode, 'local'); assert.equal(loc.readOnly, false); assert.equal(loc.bindHost, '127.0.0.1'); assert.equal(loc.port, 8787); assert.equal(loc.tokenMint, null);
  assert.equal(loc.dataDir, path.join(ROOT, 'data'));
  assert.match(resolveRuntime({ BIND_HOST: '0.0.0.0' }, cfg, ROOT).errors[0], /only be changed in public mode/);
  assert.match(resolveRuntime({ PAYPER_MODE: 'admin' }, cfg, ROOT).errors[0], /PAYPER_MODE/);

  const pubNo = resolveRuntime({ PAYPER_MODE: 'public' }, cfg, ROOT); assert.match(pubNo.errors.join(), /needs PUBLIC_ORIGIN/);
  for (const o of ['http://payper.example.com', 'https://*.example.com', 'https://payper.example.com/app', 'https://u:p@payper.example.com', 'https://payper.example.com/?x=1', 'payper.example.com'])
    assert.ok(resolveRuntime({ PAYPER_MODE: 'public', PUBLIC_ORIGIN: o }, cfg, ROOT).errors.length, o);
  const pub = resolveRuntime({ PAYPER_MODE: 'public', PUBLIC_ORIGIN: 'https://Payper.Example.com', PORT: '10000', DATA_DIR: '/var/data', TRUSTED_HOSTS: 'www.payper.example.com' }, cfg, ROOT);
  assert.deepEqual(pub.errors, []); assert.equal(pub.readOnly, true); assert.equal(pub.bindHost, '0.0.0.0'); assert.equal(pub.port, 10000);
  assert.equal(pub.publicOrigin, 'https://payper.example.com'); assert.deepEqual([...pub.trustedHosts].sort(), ['payper.example.com', 'www.payper.example.com']);
  assert.equal(pub.dataDir, path.resolve('/var/data')); assert.deepEqual(pub.warnings, []);
  assert.ok(resolveRuntime({ PAYPER_MODE: 'public', PUBLIC_ORIGIN: 'https://a.example', TRUSTED_HOSTS: '*.example' }, cfg, ROOT).errors.some((e) => /wildcards/.test(e)));
  assert.ok(resolveRuntime({ PAYPER_MODE: 'public', PUBLIC_ORIGIN: 'https://a.example', TRUSTED_HOSTS: 'https://b.example' }, cfg, ROOT).errors.some((e) => /not a host name/.test(e)));
  assert.match(resolveRuntime({ PAYPER_MODE: 'public', PUBLIC_ORIGIN: 'https://a.example' }, cfg, ROOT).warnings[0], /DATA_DIR is not set/);
  assert.equal(resolveRuntime({ PAYPER_MODE: 'public', PUBLIC_ORIGIN: 'https://a.example' }, cfg, ROOT).port, 8080);
  assert.match(resolveRuntime({ PORT: 'abc' }, cfg, ROOT).errors[0], /PORT/);
  // http is accepted only for localhost testing
  assert.deepEqual(resolveRuntime({ PAYPER_MODE: 'public', PUBLIC_ORIGIN: 'http://localhost:9000', DATA_DIR: '/tmp/x' }, cfg, ROOT).errors, []);
  // Render: platform URL used when PUBLIC_ORIGIN is absent; the onrender host is always trusted
  const r = resolveRuntime({ PAYPER_MODE: 'public', RENDER_EXTERNAL_URL: 'https://payper.onrender.com', RENDER_EXTERNAL_HOSTNAME: 'payper.onrender.com', DATA_DIR: '/var/data' }, cfg, ROOT);
  assert.deepEqual(r.errors, []); assert.equal(r.publicOrigin, 'https://payper.onrender.com');
  const r2 = resolveRuntime({ PAYPER_MODE: 'public', PUBLIC_ORIGIN: 'https://payper.example.com', RENDER_EXTERNAL_HOSTNAME: 'payper.onrender.com', DATA_DIR: '/var/data' }, cfg, ROOT);
  assert.equal(r2.publicOrigin, 'https://payper.example.com'); assert.ok(r2.trustedHosts.has('payper.onrender.com'));
  // contract address sources
  assert.equal(resolveRuntime({}, { ...cfg, contractAddress: A3 }, ROOT).tokenSource, 'paper.config.json');
  const both = resolveRuntime({ TOKEN_MINT: MINT }, { ...cfg, contractAddress: A3 }, ROOT); assert.equal(both.tokenMint, MINT); assert.equal(both.tokenSource, 'TOKEN_MINT');
  assert.equal(resolveRuntime({ TOKEN_MINT: '  ' }, { ...cfg, contractAddress: A3 }, ROOT).tokenMint, A3, 'a blank TOKEN_MINT falls back to the config value');
  const badEnv = resolveRuntime({ TOKEN_MINT: 'https://pump.fun/coin/x' }, cfg, ROOT); assert.match(badEnv.errors[0], /^TOKEN_MINT: /); assert.equal(badEnv.tokenMint, null);
  assert.match(resolveRuntime({}, { ...cfg, contractAddress: 'abc' }, ROOT).errors[0], /^contractAddress in paper\.config\.json: /);
});

test('public mode: every state-changing request is refused with 403 and changes nothing', async () => {
  const { app, port } = await bootPublic();
  try {
    // An agent created by the operator before going public (engine call, not HTTP) must survive.
    const made = app.engine.saveCustom({ name: 'mine', conditions: [{ field: 'chgH1', op: '>=', value: 1 }] }); assert.ok(made.ok);
    await app.engine.tick();
    const before = JSON.stringify(app.engine.state);
    const id = made.agent.id; const origin = { origin: 'https://' + HOST };
    const attempts = [
      ['POST', '/api/agents/custom', { name: 'x', conditions: [{ field: 'chgH1', op: '>=', value: 1 }] }], ['POST', '/api/me/agent', { name: 'y', conditions: [] }],
      ['POST', `/api/agents/custom/${id}/stop`, {}], ['POST', `/api/agents/custom/${id}/start`, {}], ['DELETE', `/api/agents/custom/${id}`, null],
      ['POST', '/api/control/pause', {}], ['POST', '/api/control/resume', {}], ['POST', '/api/control/reset', { confirm: 'RESET' }],
      ['POST', '/api/me/wallet', {}], ['PUT', '/api/agents/custom', {}], ['PATCH', '/api/control/pause', {}], ['POST', '/api/anything', {}], ['OPTIONS', '/api/control/reset', null],
    ];
    for (const [m, p, body] of attempts) {
      for (const headers of [{}, origin]) {
        const r = await req(port, m, p, { body, headers }); assert.equal(r.status, 403, `${m} ${p}`); assert.equal(r.json.error, 'read-only');
        assert.match(r.json.reason, /read-only.*not your wallet/s); assert.equal(r.headers.allow, 'GET, HEAD');
      }
    }
    // oversized body is refused before it is read
    assert.equal((await req(port, 'POST', '/api/agents/custom', { body: { name: 'a'.repeat(20000) } })).status, 403);
    assert.equal(JSON.stringify(app.engine.state), before, 'state unchanged');
    assert.ok(app.engine.state.agents?.custom?.some?.((a) => a.id === id) ?? true);
    // GET requests still work
    for (const p of ['/api/status', '/api/capabilities', '/api/families', '/api/agents', '/api/quorums', '/api/ledger', '/api/state', '/api/market', '/api/fields', '/api/project'])
      assert.equal((await req(port, 'GET', p)).status, 200, p);
    assert.equal((await req(port, 'GET', '/api/capabilities')).json.readOnly, true);
  } finally { await app.close(); }
});

test('public mode: /api/project reports read-only shared demo, paper only, and the token state', async () => {
  let { app, port } = await bootPublic();
  try {
    const j = (await req(port, 'GET', '/api/project')).json;
    assert.equal(j.name, 'Payper'); assert.equal(j.ticker, 'PAYPER'); assert.equal(j.mode, 'public-read-only'); assert.equal(j.readOnly, true); assert.equal(j.sharedDemo, true);
    assert.equal(j.paperOnly, true); assert.equal(j.realTrading, false); assert.equal(j.walletConnect, false);
    assert.deepEqual({ s: j.token.status, m: j.token.mint, u: j.token.pumpFunUrl }, { s: 'not-launched', m: null, u: null });
    assert.match(j.note, /Real trading is not implemented/); assert.match(j.note, /not promised/);
  } finally { await app.close(); }
  ({ app, port } = await bootPublic({ tokenMint: MINT }));
  try {
    const t = (await req(port, 'GET', '/api/project')).json.token;
    assert.equal(t.status, 'address-set'); assert.equal(t.mint, MINT); assert.equal(t.pumpFunUrl, 'https://pump.fun/coin/' + MINT); assert.match(t.check, /Format checked only/);
  } finally { await app.close(); }
});

test('public mode: exact Host allow-list, health check, HSTS, stream cap', async () => {
  const { app, port } = await bootPublic({ extraHosts: ['www.payper.example.com'] });
  try {
    assert.equal((await req(port, 'GET', '/')).status, 200);
    assert.equal((await req(port, 'GET', '/', { host: 'www.payper.example.com' })).status, 200);
    assert.equal((await req(port, 'GET', '/', { host: HOST + ':443' })).status, 200, 'default https port is the same origin');
    for (const h of ['evil.example', `127.0.0.1:${port}`, `localhost:${port}`, 'payper.example.com.evil.example', 'sub.payper.example.com', '']) {
      const r = await req(port, 'GET', '/api/status', { host: h }); assert.equal(r.status, 421, h); assert.match(r.body, /https:\/\/payper\.example\.com\//);
    }
    // X-Forwarded-Host is never trusted to bypass the check
    assert.equal((await req(port, 'GET', '/api/status', { host: 'evil.example', headers: { 'x-forwarded-host': HOST } })).status, 421);
    const hz = await req(port, 'GET', '/healthz', { host: 'internal-probe:10000' }); assert.equal(hz.status, 200); assert.equal(hz.body, 'ok');
    assert.equal((await req(port, 'HEAD', '/healthz', { host: 'x' })).status, 200);
    assert.equal((await req(port, 'POST', '/healthz', { host: HOST, body: {} })).status, 405, 'only GET/HEAD');
    const home = await req(port, 'GET', '/'); assert.match(home.headers['strict-transport-security'], /max-age=\d+/);
    assert.match(home.headers['content-security-policy'], /default-src 'self'/);
  } finally { await app.close(); }
});

test('public mode: only public/ assets are served; API JSON shows no server file paths', async () => {
  const { app, port, dir } = await bootPublic({ tokenMint: MINT });
  try {
    for (const p of ['/paper.config.json', '/package.json', '/server/app.mjs', '/server/deploy.mjs', '/data/state.json', '/data/server.lock', '/tests/public.test.mjs', '/README.md', '/.env', '/START.bat', '/Dockerfile', '/render.yaml',
      '/../paper.config.json', '/%2e%2e/paper.config.json', '/..%2fserver%2fapp.mjs', '/%2e%2e%5cpaper.config.json', '/public/index.html']) {
      const r = await req(port, 'GET', p); assert.ok(r.status === 404 || r.status === 403 || (r.status === 200 && /<title>Payper · a paper-trading record/.test(r.body)), `${p} -> ${r.status}`);
      assert.ok(!/"startingCashUsd"|createApp|resolveRuntime|TOKEN_MINT|PAYPER_MODE/.test(r.body), p);
    }
    await app.engine.tick();
    const leak = [ROOT, dir, os.tmpdir(), os.homedir(), 'state.json', 'server.lock', 'DATA_DIR', 'node_modules'];
    for (const p of ['/api/status', '/api/capabilities', '/api/project', '/api/state', '/api/ledger', '/api/market', '/api/agents', '/api/families', '/api/quorums', '/api/fields', '/api/nope']) {
      const b = (await req(port, 'GET', p)).body; for (const s of leak) assert.ok(!b.includes(s), `${p} leaks ${s}`);
    }
  } finally { await app.close(); }
});

test('local mode is unchanged: loopback only, writes allowed from the same origin', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'payper loc ')); const c = clock();
  const app = createApp({ cfg: testConfig({ port: 18791 }), market: fakeMarket(() => [strong()], c), stateFile: path.join(dir, 'state.json'), now: c.now, log: () => {}, autoTick: false });
  const port = await app.listen(0); const host = `127.0.0.1:${port}`;
  try {
    assert.equal(app.server.address().address, '127.0.0.1');
    const j = (await req(port, 'GET', '/api/project', { host })).json; assert.equal(j.mode, 'local'); assert.equal(j.readOnly, false); assert.equal(j.token.status, 'not-launched');
    assert.equal((await req(port, 'POST', '/api/control/pause', { host, body: {} })).status, 200);
    assert.equal((await req(port, 'POST', '/api/control/resume', { host, body: {} })).status, 200);
    assert.equal((await req(port, 'GET', '/', { host: HOST })).status, 421, 'a public host name is refused locally');
    assert.equal((await req(port, 'GET', '/', { host })).headers['strict-transport-security'], undefined);
  } finally { await app.close(); }
});
