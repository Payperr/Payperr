import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEngine } from '../server/engine.mjs';
import { createApp } from '../server/app.mjs';
import { A1, A2, A3, strong, weak, pair, fakeMarket, clock, testConfig } from './helpers.mjs';

function rig(over = {}, script = () => [strong()], opts = {}) {
  const c = clock(); const cfg = testConfig(over); const ev = []; const market = fakeMarket(script, c, opts);
  const e = createEngine({ cfg, market, now: c.now, emit: (k, d) => ev.push([k, d]) });
  const step = async (ms = 30000) => { c.advance(ms); return e.tick(); };
  return { c, cfg, e, ev, step, S: e.state, market };
}
const kinds = (ev, k) => ev.filter(([x]) => x === k).map(([, d]) => d);

test('empty first run: weak signals produce no quorum and no trades', async () => {
  const { e, step, S, ev } = rig({}, () => [weak(), pair(A1, 'SOL', { m5: -1, h1: -2, b5: 5, s5: 50, volM5: 10, volH1: 100000 })]);
  await step(); await step();
  assert.equal(S.quorums.length, 0); assert.equal(S.ledger.length, 0); assert.equal(S.positions.length, 0); assert.equal(S.cash, 10000);
  assert.ok(kinds(ev, 'check').length > 0, 'agents really evaluated the data');
  assert.equal(e.status().account.pnlUsd, 0);
});

test('quorum needs distinct families; votes from one family are not enough', async () => {
  const r = rig({ quorum: { minVotes: 4, minFamilies: 4 } });
  await r.step(); assert.equal(r.S.quorums.length, 0, '4 votes from 3 families does not meet minFamilies 4');
  const ticks = kinds(r.ev, 'tick').filter((t) => t.mint === A2); assert.ok(ticks[0].votes >= 3); assert.equal(ticks[0].fams.length, 3);
  const r2 = rig(); await r2.step(); const q = r2.S.quorums[0];
  assert.ok(q, 'quorum formed'); assert.deepEqual(new Set(q.fams), new Set(['momentum', 'volume', 'pressure']));
  for (const f of q.fams) { assert.ok(q.voters[f].length >= 1); assert.ok(q.checks[f].every((k) => k.ok === true && k.src && k.v)); }
  assert.equal(q.state, 'buy'); assert.equal(q.order.status, 'pending'); assert.ok(q.risk.every((c) => c.ok));
  assert.equal(r2.S.cash, 10000, 'no cash moves at decision time');
});

test('delayed paper fill at the worse of decision and next price, with fees + slippage', async () => {
  let price = 1; const r = rig({}, () => [strong(A2, 'JUP', { price })]);
  await r.step(); price = 1.02; await r.step();
  const pos = r.S.positions[0]; assert.ok(pos); assert.equal(pos.entryRef, 1.02);
  assert.ok(Math.abs(pos.entryPrice - 1.02 * 1.015) < 1e-9, 'slippage 150 bps on top of the worse price');
  assert.equal(r.S.cash, 10000 - 100); assert.ok(r.S.feesTotal > 1.4 && r.S.feesTotal < 1.6);
  const b = r.S.ledger.find((l) => l.kind === 'buy'); assert.ok(b.paper); assert.match(b.note, /simulated fill/); assert.ok(!('sig' in b));
  const tr = kinds(r.ev, 'trade')[0]; assert.equal(tr.paper, true); assert.equal(tr.simulatedFill, true); assert.ok(!tr.sig);
});

test('invalid quote (zero / missing price, missing liquidity) halts entries', async () => {
  for (const o of [{ price: 0 }, { price: 'NaN' }, { liq: null }]) {
    const r = rig({}, () => [strong(A2, 'JUP', o)]); await r.step(); await r.step();
    assert.equal(r.S.positions.length, 0, JSON.stringify(o));
    if (o.liq === null) assert.ok(r.S.quorums.length === 0 || r.S.quorums[0].state === 'skip');
    else assert.equal(r.S.quorums.length, 0);
  }
});

test('stale quotes: pending buy cancelled, exits wait, valuation marked stale', async () => {
  const fail = new Set([1]); const r = rig({}, () => [strong()], { failAt: fail });
  await r.step();                 // decision
  await r.step(100000);           // feed fails, last quote now >90 s old
  assert.equal(r.S.positions.length, 0); assert.equal(r.S.pending.length, 0);
  assert.equal(r.S.quorums[0].order.status, 'cancelled'); assert.match(r.S.ledger[0].note, /cancelled/);
  assert.equal(r.e.status().feed.state, 'stale');
  // now an open position whose quote goes stale: no sell is invented
  let price = 1; const fail2 = new Set(); const r2 = rig({}, () => [strong(A2, 'JUP', { price })], { failAt: fail2 });
  await r2.step(); await r2.step(); assert.equal(r2.S.positions.length, 1);
  price = 0.5; fail2.add(2); fail2.add(3); await r2.step(100000); await r2.step(100000);
  assert.equal(r2.S.positions.length, 1, 'no exit without a valid fresh price'); assert.equal(r2.e.positions()[0].markStale, true);
  assert.equal(r2.e.status().account.equityStaleMarks, 1);
  await r2.step(); await r2.step(); // feed back: stop loss decided, then filled at the next quote
  assert.equal(r2.S.positions.length, 0); assert.match(r2.S.ledger.find((l) => l.kind === 'sell').note, /stop loss/);
});

test('dedupe: same observation judged once; repeated denials not re-recorded', async () => {
  const r = rig();
  await r.step(); const n1 = kinds(r.ev, 'check').length; await r.e.tick(); // same clock -> same observedAt
  assert.equal(kinds(r.ev, 'check').length, n1, 'no re-evaluation of an identical observation');
  await r.step(); assert.equal(r.S.positions.length, 1);
  await r.step(); await r.step(); await r.step();
  const denied = r.S.quorums.filter((q) => q.state === 'skip');
  assert.equal(denied.length, 1, 'one denial recorded, later identical ones suppressed'); assert.match(denied[0].why, /No open or pending position/);
  assert.equal(r.S.positions.length, 1); assert.equal(r.S.ledger.filter((l) => l.kind === 'buy').length, 1);
});

test('insufficient virtual cash keeps the reserve', async () => {
  const r = rig({ paper: { startingCashUsd: 650, reserveUsd: 500, tradeSizeUsd: 100 } }, () => [strong(A2, 'JUP'), strong(A3, 'BONK')]);
  await r.step(); await r.step();
  assert.equal(r.S.positions.length, 1); const d = r.S.quorums.find((q) => q.mint === A3); assert.match(d.why, /Cash covers/);
  assert.ok(r.S.cash >= 500);
});

test('hourly buy cap with rolling 60 minutes', async () => {
  const r = rig({ risk: { maxBuysPerHour: 1 } }, (k) => k < 3 ? [strong(A2, 'JUP')] : [strong(A2, 'JUP'), strong(A3, 'BONK')]);
  await r.step(); await r.step(); assert.equal(r.S.positions.length, 1);
  await r.step(); await r.step(); const d = r.S.quorums.find((q) => q.mint === A3); assert.match(d.why, /Buys in the last 60 min/);
  await r.step(61 * 60000); await r.step();
  assert.ok(r.S.positions.some((p) => p.mint === A3) || r.S.pending.some((o) => o.mint === A3), 'allowed again after the hour');
});

test('exposure limit', async () => {
  const r = rig({ risk: { maxExposureUsd: 150 } }, () => [strong(A2, 'JUP'), strong(A3, 'BONK')]);
  await r.step(); await r.step();
  assert.equal(r.S.positions.length + r.S.pending.length, 1); assert.match(r.S.quorums.find((q) => q.mint === A3).why, /Exposure/);
});

test('daily loss pause (realized + unrealized) and lift at the next Asia/Manila day', async () => {
  let price = 1; const r = rig({ risk: { dailyLossLimitUsd: 5 }, exits: { stopLossPct: 90 } }, (k) => k < 2 ? [strong(A2, 'JUP', { price })] : [strong(A2, 'JUP', { price }), strong(A3, 'BONK')]);
  await r.step(); await r.step(); assert.equal(r.S.positions.length, 1);
  price = 0.8; await r.step();
  assert.equal(r.S.day.paused, true); assert.ok(r.S.ledger.some((l) => /Daily loss/.test(l.note)));
  await r.step(); assert.ok(!r.S.quorums.some((q) => q.mint === A3 && q.state === 'buy'), 'no new buys while paused');
  const day0 = r.S.day.key; r.c.advance(14 * 3600000); await r.step(); // 02:00 UTC + 14 h = after 00:00 Asia/Manila
  assert.notEqual(r.S.day.key, day0); assert.equal(r.S.day.paused, false); assert.ok(r.S.ledger.some((l) => /pause lifted/.test(l.note)));
});

test('partial exits: take-profit ladder sells 50 % then the rest; realized P&L after costs', async () => {
  let price = 1; const r = rig({}, () => [strong(A2, 'JUP', { price })]);
  await r.step(); await r.step(); const pos = r.S.positions[0]; const q0 = pos.qty0;
  price = pos.entryPrice * 1.09; await r.step(); price = pos.entryPrice * 1.10; await r.step();
  assert.equal(r.S.positions.length, 1); assert.ok(Math.abs(r.S.positions[0].qty - q0 / 2) < q0 * 1e-9);
  const s1 = r.S.ledger.find((l) => l.kind === 'sell'); assert.match(s1.note, /take profit/); assert.ok(s1.pnl > 0);
  price = pos.entryPrice * 1.17; await r.step(); price = pos.entryPrice * 1.18; await r.step();
  assert.equal(r.S.positions.length, 0); assert.equal(r.S.closed.length, 1);
  const net = r.S.cash - 10000; assert.ok(Math.abs(net - r.S.realizedTotal) < 1e-6, 'cash change equals realized P&L');
  assert.ok(r.S.quorums.find((q) => q.id === pos.quorumId).pnl > 0);
});

test('custom agents change execution; unsupported fields rejected', async () => {
  const r = rig({ quorum: { minVotes: 4, minFamilies: 4 } });
  const bad = r.e.saveCustom({ name: 'dev', conditions: [{ field: 'devSold', op: '<=', value: 0 }] }); assert.equal(bad.ok, false); assert.match(bad.errors[0], /unsupported/);
  await r.step(); assert.equal(r.S.quorums.length, 0);
  const ok = r.e.saveCustom({ name: 'hour up', conditions: [{ field: 'chgH1', op: '>=', value: 1 }] }); assert.equal(ok.ok, true);
  await r.step(); assert.equal(r.S.quorums.length, 1); assert.ok(r.S.quorums[0].fams.includes('custom'));
  const r2 = rig({ quorum: { minVotes: 4, minFamilies: 4 } }); const a = r2.e.saveCustom({ name: 'hour up', conditions: [{ field: 'chgH1', op: '>=', value: 1 }] }).agent;
  r2.e.setCustomEnabled(a.id, false); await r2.step(); assert.equal(r2.S.quorums.length, 0, 'stopped agent does not vote');
  for (let i = 0; i < 3; i++) r2.e.saveCustom({ name: 'a' + i, conditions: [{ field: 'chgH1', op: '>=', value: 1 }] });
  assert.equal(r2.e.saveCustom({ name: 'a9', conditions: [{ field: 'chgH1', op: '>=', value: 1 }] }).ok, false, 'slot limit');
});

test('pause / resume / reset with confirmation', async () => {
  const r = rig(); r.e.pause(); await r.step(); assert.equal(r.S.quorums.length, 0);
  r.e.resume(); await r.step(); assert.equal(r.S.quorums.length, 1); await r.step(); assert.equal(r.S.positions.length, 1);
  assert.equal(r.e.reset('yes').ok, false); assert.equal(r.S.positions.length, 1);
  assert.equal(r.e.reset('RESET').ok, true); assert.equal(r.S.positions.length, 0); assert.equal(r.S.cash, 10000); assert.equal(r.S.quorums.length, 0);
});

test('persistence: restart restores account, positions and ledger; corrupt file moved aside', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swp test ')); const file = path.join(dir, 'state dir', 'paper-state.json');
  const c = clock(); const cfg = testConfig(); const market = fakeMarket(() => [strong()], c);
  const a1 = createApp({ cfg, market, stateFile: file, now: c.now, log: () => {}, autoTick: false });
  c.advance(30000); await a1.engine.tick(); c.advance(30000); await a1.engine.tick(); await a1.close();
  const saved = JSON.parse(fs.readFileSync(file, 'utf8')); assert.equal(saved.positions.length, 1); assert.ok(!fs.existsSync(file + '.tmp'));
  const a2 = createApp({ cfg, market, stateFile: file, now: c.now, log: () => {}, autoTick: false });
  assert.equal(a2.restored, true); assert.equal(a2.engine.state.positions.length, 1); assert.equal(a2.engine.state.cash, 9900);
  assert.equal(a2.engine.state.ledger.length, saved.ledger.length); await a2.close();
  fs.writeFileSync(file, '{ broken'); fs.rmSync(file + '.bak', { force: true });
  const logs = []; const a3 = createApp({ cfg, market, stateFile: file, now: c.now, log: (...x) => logs.push(x.join(' ')), autoTick: false });
  assert.equal(a3.restored, false); assert.equal(a3.engine.state.cash, 10000); assert.ok(fs.readdirSync(path.dirname(file)).some((f) => f.includes('.corrupt-')));
  assert.ok(logs.some((l) => /could not be read/.test(l))); await a3.close();
});
