// The paper desk: market snapshot -> agents vote -> quorum -> risk checks -> delayed paper
// fill -> exits. All money is virtual. Every step leaves evidence in state and on the SSE bus.
import { FAMILIES, BUILTIN_AGENTS } from './strategies.mjs';
import { evaluate, validateAgent, condText } from './rules.mjs';
import { checkEntry, dayKey } from './risk.mjs';
import { buyFill, sellFill, estExitValue, exitDecision } from './paper.mjs';

export const STATE_VERSION = 1;
const LIMITS = { ledger: 5000, quorums: 600, closed: 1000, equity: 2000 };
const r2 = (v) => Math.round(v * 100) / 100;

export function freshState(cfg, now, customAgents = []) {
  return {
    version: STATE_VERSION, createdAt: now, startingCash: cfg.paper.startingCashUsd, cash: cfg.paper.startingCashUsd,
    positions: [], pending: [], closed: [], buys: [], cooldown: {}, paused: false,
    day: { key: dayKey(now, cfg.risk.dayTimeZone), startEquity: cfg.paper.startingCashUsd, paused: false, pausedAt: null, realized: 0 },
    realizedTotal: 0, feesTotal: 0, equityHist: [{ t: now, eq: cfg.paper.startingCashUsd }],
    ledger: [], quorums: [], customAgents, agentStats: {}, seq: 1, lastEval: {}, lastDenied: {},
  };
}
export const validState = (s) => !!s && s.version === STATE_VERSION && Number.isFinite(s.cash) && Array.isArray(s.positions) && Array.isArray(s.ledger) && s.day && typeof s.day.key === 'string';

export function createEngine({ cfg, market, now = () => Date.now(), state = null, save = () => {}, emit = () => {}, log = () => {} }) {
  const S = state && validState(state) ? state : freshState(cfg, now());
  // tolerate state saved by a config with fewer fields
  S.pending ||= []; S.lastDenied ||= {}; S.customAgents ||= []; S.agentStats ||= {};
  const snaps = new Map(); // mint -> latest snapshot (in memory; quotes are re-fetched after a restart)
  const feed = { lastPollAt: null, lastOkAt: null, lastError: null, discovered: [], discoveredAt: 0, polls: 0, okPolls: 0 };
  let busy = false;
  const id = (p) => `${p}${(S.seq++).toString(36)}`;
  const stat = (aid) => (S.agentStats[aid] ||= { votes: 0, quorums: 0, fills: 0, pnl: 0, checks: 0, missing: 0 });
  const push = (arr, v, max) => { arr.unshift(v); if (arr.length > max) arr.length = max; };
  const led = (row) => { const r = { id: id('L'), at: now(), paper: true, ...row }; push(S.ledger, r, LIMITS.ledger); emit('ledger', r); return r; };
  const W = new Set(cfg.market.watchlist.map((w) => w.address));

  const agents = () => [
    ...BUILTIN_AGENTS.map((a) => ({ ...a, builtin: true, enabled: true })),
    ...S.customAgents.map((a) => ({ ...a, fam: 'custom', builtin: false })),
  ];
  const fresh = (s, t = now()) => !!s && s.priceUsd > 0 && (t - s.observedAt) / 1000 <= cfg.market.maxQuoteAgeSeconds;
  const exposure = () => S.positions.reduce((a, p) => a + p.cost, 0);
  function equity(t = now()) {
    let eq = S.cash, stale = 0;
    for (const p of S.positions) { const s = snaps.get(p.mint); const ok = fresh(s, t); const ref = ok ? s.priceUsd : p.lastMark; if (!ok) stale++;
      eq += ref > 0 ? estExitValue(cfg.paper, p.qty, ref, ok ? s.metrics.liquidityUsd : p.lastLiq) : 0; }
    for (const o of S.pending) if (o.side === 'buy') eq += 0; // pending buys have not spent cash yet
    return { eq, stale };
  }
  function rollDay(t) {
    const k = dayKey(t, cfg.risk.dayTimeZone);
    if (k !== S.day.key) { const was = S.day.paused; S.day = { key: k, startEquity: equity(t).eq, paused: false, pausedAt: null, realized: 0 };
      if (was) led({ kind: 'control', who: 'risk desk', coin: '', usd: null, note: `New ${cfg.risk.dayTimeZone} day ${k}: daily-loss pause lifted.` }); }
  }
  function checkDayLoss(t) {
    const loss = S.day.startEquity - equity(t).eq;
    if (!S.day.paused && loss >= cfg.risk.dailyLossLimitUsd) { S.day.paused = true; S.day.pausedAt = t;
      led({ kind: 'control', who: 'risk desk', coin: '', usd: null, note: `Daily loss ${r2(loss)} USD (realized + estimated unrealized) reached the ${cfg.risk.dailyLossLimitUsd} USD limit: new paper buys paused until the next ${cfg.risk.dayTimeZone} day.` });
      for (const o of S.pending.filter((o) => o.side === 'buy')) cancel(o, 'daily loss pause'); }
    return loss;
  }
  function cancel(o, why) { S.pending = S.pending.filter((x) => x !== o); const q = S.quorums.find((x) => x.id === o.quorumId);
    if (q) { q.order = { ...q.order, status: 'cancelled', why }; q.state = 'skip'; q.why = 'order cancelled: ' + why; }
    led({ kind: 'cancel', who: 'paper desk', coin: o.sym, mint: o.mint, usd: null, note: `${o.side.toUpperCase()} order cancelled (no fill): ${why}`, orderId: o.id }); }

  function fillPending(t) {
    for (const o of [...S.pending]) {
      const s = snaps.get(o.mint); const isNew = s && s.observedAt > o.decisionObservedAt;
      if (o.side === 'buy') {
        if (!fresh(s, t)) { cancel(o, 'quote stale or missing at fill time'); continue; }
        if (!isNew) { if (++o.waits > 3) cancel(o, 'no newer quote arrived after 3 polls'); continue; }
        if (!(s.metrics.liquidityUsd >= cfg.risk.minLiquidityUsd)) { cancel(o, 'liquidity fell below the floor'); continue; }
        if (S.paused || S.day.paused) { cancel(o, S.paused ? 'desk paused' : 'daily loss pause'); continue; }
        const ref = Math.max(o.decisionPrice, s.priceUsd); // adverse: buy at the worse (higher) of decision and next price
        const f = buyFill(cfg.paper, o.spendUsd, ref, s.metrics.liquidityUsd);
        if (!f || S.cash - o.spendUsd < cfg.paper.reserveUsd - 1e-9) { cancel(o, 'insufficient virtual cash'); continue; }
        S.pending = S.pending.filter((x) => x !== o);
        S.cash -= o.spendUsd; S.feesTotal += f.feeUsd; S.buys.push(t); S.buys = S.buys.filter((x) => t - x < 3600000); S.cooldown[o.mint] = t;
        const pos = { id: id('P'), mint: o.mint, sym: o.sym, url: s.url, openedAt: t, qty: f.qty, qty0: f.qty, cost: o.spendUsd, cost0: o.spendUsd, entryPrice: f.fillPrice, entryRef: ref, peak: s.priceUsd, tpDone: cfg.exits.takeProfit.map(() => false), quorumId: o.quorumId, voters: o.voters, lastMark: s.priceUsd, lastMarkAt: s.observedAt, lastLiq: s.metrics.liquidityUsd, realized: 0 };
        S.positions.push(pos);
        for (const v of o.voters) stat(v).fills++;
        const q = S.quorums.find((x) => x.id === o.quorumId); if (q) { q.order = { ...q.order, status: 'filled', fill: f, filledAt: t }; q.positionId = pos.id; }
        led({ kind: 'buy', who: 'quorum ' + o.quorumId, coin: o.sym, mint: o.mint, usd: -o.spendUsd, note: `PAPER BUY ${f.qty.toPrecision(6)} @ $${f.fillPrice.toPrecision(6)} (simulated fill: ref $${ref.toPrecision(6)} = worse of decision & next quote, +${f.slipBps} bps slippage est., fees est. $${f.feeUsd})`, orderId: o.id });
        emit('trade', { at: t, kind: 'BUY', sym: o.sym, mint: o.mint, usd: o.spendUsd, pnl: null, reason: 'quorum ' + o.quorumId, paper: true, simulatedFill: true });
      } else {
        const pos = S.positions.find((p) => p.id === o.positionId); if (!pos) { S.pending = S.pending.filter((x) => x !== o); continue; }
        if (!isNew || !fresh(s, t)) { o.waits++; pos.markStale = !fresh(s, t); continue; } // exits WAIT for a valid, newer price
        const ref = Math.min(o.decisionPrice, s.priceUsd); // adverse: sell at the worse (lower)
        const qty = Math.min(o.qty, pos.qty); const f = sellFill(cfg.paper, qty, ref, s.metrics.liquidityUsd);
        S.pending = S.pending.filter((x) => x !== o); if (!f) continue;
        const basis = pos.cost * (qty / pos.qty); const pnl = f.proceedsUsd - basis;
        pos.qty -= qty; pos.cost -= basis; pos.realized += pnl; (o.tpSteps || []).forEach((i) => (pos.tpDone[i] = true));
        S.cash += f.proceedsUsd; S.feesTotal += f.feeUsd; S.realizedTotal += pnl; S.day.realized += pnl;
        const share = pnl / Math.max(1, pos.voters.length); for (const v of pos.voters) stat(v).pnl += share;
        const closed = pos.qty <= pos.qty0 * 1e-9;
        led({ kind: 'sell', who: o.reason.split(':')[0], coin: pos.sym, mint: pos.mint, usd: f.proceedsUsd, pnl, note: `PAPER SELL ${qty.toPrecision(6)} @ $${f.fillPrice.toPrecision(6)} (simulated fill: ref $${ref.toPrecision(6)}, −${f.slipBps} bps slippage est., fees est. $${f.feeUsd}) · ${o.reason}${closed ? ' · position closed' : ''}`, orderId: o.id });
        emit('trade', { at: t, kind: 'SELL', sym: pos.sym, mint: pos.mint, usd: f.proceedsUsd, pnl, reason: o.reason, paper: true, simulatedFill: true });
        const q = S.quorums.find((x) => x.id === pos.quorumId); if (q) q.pnl = pos.realized;
        if (closed) { S.positions = S.positions.filter((p) => p !== pos); push(S.closed, { ...pos, closedAt: t, pnl: pos.realized }, LIMITS.closed); }
      }
    }
  }
  function manageExits(t) {
    for (const pos of S.positions) {
      const s = snaps.get(pos.mint); const ok = fresh(s, t); pos.markStale = !ok;
      if (!ok) continue;
      pos.lastMark = s.priceUsd; pos.lastMarkAt = s.observedAt; pos.lastLiq = s.metrics.liquidityUsd; pos.peak = Math.max(pos.peak, s.priceUsd);
      if (S.pending.some((o) => o.positionId === pos.id)) continue;
      const d = exitDecision(cfg.exits, pos, s.priceUsd, t); if (!d) continue;
      S.pending.push({ id: id('O'), side: 'sell', positionId: pos.id, mint: pos.mint, sym: pos.sym, qty: d.qty, reason: d.reason, tpSteps: d.tpSteps, decidedAt: t, decisionPrice: s.priceUsd, decisionObservedAt: s.observedAt, waits: 0 });
    }
  }
  function evaluateEntries(t) {
    const famOf = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
    for (const s of snaps.values()) {
      if (S.lastEval[s.mint] === s.observedAt) continue; // idempotent: each observation is judged once
      if (!fresh(s, t)) continue;                         // stale or invalid quotes never produce votes
      S.lastEval[s.mint] = s.observedAt;
      const voters = {}, checks = {}; let claims = 0;
      for (const a of agents()) {
        if (!a.enabled) continue;
        const ev = evaluate(a.conditions, s); const st = stat(a.id); st.checks++; if (ev.missing) st.missing++;
        const fail = ev.results.filter((r) => r.ok !== true).length;
        emit('check', { at: t, agent: a.id, fam: a.fam, sym: s.sym, mint: s.mint, n: ev.results.length, fail, missing: ev.missing, ok: ev.pass });
        if (!ev.pass) continue;
        st.votes++; (voters[a.fam] ||= []).push(a.id); (checks[a.fam] ||= []).push(...ev.results.map((r) => ({ c: r.c, v: r.v, src: r.src, ok: r.ok, agent: a.id }))); claims += ev.results.length;
        emit('prop', { at: t, agent: a.id, fam: a.fam, sym: s.sym, mint: s.mint, claims: ev.results.length, note: a.name });
      }
      const fams = Object.keys(voters); const n = fams.reduce((x, f) => x + voters[f].length, 0);
      emit('tick', { mint: s.mint, sym: s.sym, mc: s.metrics.marketCap, price: s.priceUsd, liq: s.metrics.liquidityUsd, votes: n, fams, need: cfg.quorum.minVotes, observedAt: s.observedAt });
      if (n < cfg.quorum.minVotes || fams.length < cfg.quorum.minFamilies) continue;
      // Quorum reached -> risk desk
      const dayLossUsd = S.day.startEquity - equity(t).eq;
      const risk = checkEntry({ now: t, snap: s, cfg, acct: S, exposureUsd: exposure(), dayLossUsd });
      if (!risk.ok) { // do not flood the record with the same denial every poll
        const last = S.lastDenied[s.mint]; const failId = risk.checks.find((c) => !c.ok).id;
        if (last && last.id === failId && t - last.at < 15 * 60000) { last.suppressed = (last.suppressed || 0) + 1; continue; }
        S.lastDenied[s.mint] = { id: failId, at: t };
      }
      const all = Object.values(voters).flat(); for (const v of all) stat(v).quorums++;
      const q = { id: id('Q'), at: t, sym: s.sym, mint: s.mint, url: s.url, pairAddress: s.pairAddress, dexId: s.dexId,
        n, need: cfg.quorum.minVotes, needFams: cfg.quorum.minFamilies, fams, lins: new Set(fams.map((f) => famOf[f]?.lineage || f)).size, claims, checks, voters,
        window: fams.flatMap((f) => voters[f].map(() => ({ t: 0, ok: true, f }))), withinSec: 0,
        priceUsd: s.priceUsd, mc: s.metrics.marketCap, fdv: s.metrics.fdv, liquidity: s.metrics.liquidityUsd, observedAt: s.observedAt, fetchedAt: s.fetchedAt, quoteAgeSec: Math.round((t - s.observedAt) / 1000), source: s.source,
        risk: risk.checks, state: risk.ok ? 'buy' : 'skip', why: risk.why, order: null, pnl: null, paper: true };
      if (risk.ok) { const o = { id: id('O'), side: 'buy', mint: s.mint, sym: s.sym, spendUsd: cfg.paper.tradeSizeUsd, quorumId: q.id, voters: all, decidedAt: t, decisionPrice: s.priceUsd, decisionObservedAt: s.observedAt, waits: 0 };
        S.pending.push(o); q.order = { id: o.id, status: 'pending', note: 'fills at the next newer quote, at the worse of the two prices' }; }
      push(S.quorums, q, LIMITS.quorums); emit('quorum', q);
    }
  }

  async function tick() {
    if (busy) return { skipped: true }; busy = true;
    try {
      const t0 = now(); feed.lastPollAt = t0; feed.polls++;
      rollDay(t0);
      const D = cfg.market.discovery;
      if (D.enabled && D.maxTokens > 0 && t0 - feed.discoveredAt >= D.refreshMinutes * 60000) {
        const d = await market.discover(D.sources, D.maxTokens); feed.discoveredAt = t0;
        if (d.addresses.length || d.ok) feed.discovered = d.addresses.filter((a) => !W.has(a)).slice(0, D.maxTokens);
      }
      const addrs = [...W, ...feed.discovered, ...S.positions.map((p) => p.mint), ...S.pending.map((o) => o.mint)];
      const r = await market.quotes(addrs);
      for (const [a, s] of r.snaps) snaps.set(a, s);
      // forget discovered tokens we no longer track and have no position in
      const keep = new Set(addrs); for (const k of snaps.keys()) if (!keep.has(k)) snaps.delete(k);
      if (r.ok) { feed.lastOkAt = now(); feed.okPolls++; feed.lastError = null; } else feed.lastError = { at: now(), message: r.errors.join('; ') };
      const t = now();
      fillPending(t); manageExits(t); checkDayLoss(t);
      if (!S.paused && !S.day.paused) evaluateEntries(t);
      const e = equity(t); push(S.equityHist, { t, eq: r2(e.eq) }, LIMITS.equity);
      save(S); emit('status', status());
      return { ok: r.ok, quotes: r.snaps.size, errors: r.errors };
    } catch (e) { log('engine', e.stack || e.message); feed.lastError = { at: now(), message: 'engine error: ' + e.message }; return { ok: false, error: e.message }; }
    finally { busy = false; }
  }

  function status() {
    const t = now(); const e = equity(t); const ages = [...snaps.values()].map((s) => (t - s.observedAt) / 1000);
    const valid = [...snaps.values()].filter((s) => fresh(s, t)).length;
    const unreal = S.positions.reduce((a, p) => { const s = snaps.get(p.mint); const ok = fresh(s, t); const ref = ok ? s.priceUsd : p.lastMark; return a + (ref > 0 ? estExitValue(cfg.paper, p.qty, ref, ok ? s.metrics.liquidityUsd : p.lastLiq) : 0) - p.cost; }, 0);
    const feedState = !feed.lastPollAt ? 'starting' : !feed.lastOkAt ? 'down' : (t - feed.lastOkAt) / 1000 > cfg.market.maxQuoteAgeSeconds ? 'stale' : feed.lastError ? 'degraded' : 'live';
    return {
      at: t, paper: true, realExecution: false,
      feed: { state: feedState, provider: 'DexScreener (public, no key)', lastPollAt: feed.lastPollAt, lastOkAt: feed.lastOkAt, lastError: feed.lastError, tracked: snaps.size, validQuotes: valid, oldestQuoteSec: ages.length ? Math.round(Math.max(...ages)) : null, newestQuoteSec: ages.length ? Math.round(Math.min(...ages)) : null, pollSeconds: cfg.market.pollSeconds, maxQuoteAgeSeconds: cfg.market.maxQuoteAgeSeconds, watchlist: W.size, discovered: feed.discovered.length, requests: market.state?.requests ?? null, rateLimited: market.state?.rateLimited ?? null },
      desk: { paused: S.paused, dayPaused: S.day.paused, dayKey: S.day.key, dayTimeZone: cfg.risk.dayTimeZone, dayStartEquity: r2(S.day.startEquity), dayLossUsd: r2(S.day.startEquity - e.eq), dayRealizedUsd: r2(S.day.realized) },
      account: { label: 'PAPER · virtual USD', startingCash: S.startingCash, cash: r2(S.cash), equity: r2(e.eq), equityStaleMarks: e.stale, exposureUsd: r2(exposure()), unrealizedUsd: r2(unreal), realizedUsd: r2(S.realizedTotal), feesUsd: r2(S.feesTotal), pnlUsd: r2(e.eq - S.startingCash), openPositions: S.positions.length, pendingOrders: S.pending.length, buysLastHour: S.buys.filter((x) => t - x < 3600000).length },
      limits: { tradeSizeUsd: cfg.paper.tradeSizeUsd, reserveUsd: cfg.paper.reserveUsd, maxExposureUsd: cfg.risk.maxExposureUsd, maxBuysPerHour: cfg.risk.maxBuysPerHour, dailyLossLimitUsd: cfg.risk.dailyLossLimitUsd, maxOpenPositions: cfg.risk.maxOpenPositions, minLiquidityUsd: cfg.risk.minLiquidityUsd, cooldownMinutes: cfg.risk.cooldownMinutes, quorum: cfg.quorum, feeBps: cfg.paper.feeBps, slippageBps: cfg.paper.slippageBps, flatFeeUsd: cfg.paper.flatFeeUsd, priceImpactModel: cfg.paper.priceImpactModel, maxPctOfLiquidity: cfg.paper.maxPctOfLiquidity, exits: cfg.exits },
      counts: { quorums: S.quorums.length, ledger: S.ledger.length, closed: S.closed.length, agents: agents().length, customAgents: S.customAgents.length },
    };
  }
  function markets() {
    const t = now();
    return [...snaps.values()].map((s) => ({ mint: s.mint, sym: s.sym, name: s.name, url: s.url, dexId: s.dexId, quoteSym: s.quoteSym, priceUsd: s.priceUsd, metrics: s.metrics, problems: s.problems, observedAt: s.observedAt, fetchedAt: s.fetchedAt, ageSec: Math.round((t - s.observedAt) / 1000), fresh: fresh(s, t), watch: W.has(s.mint) ? 'watchlist' : 'discovery', source: s.source }))
      .sort((a, b) => (b.metrics.liquidityUsd || 0) - (a.metrics.liquidityUsd || 0));
  }
  function positions() {
    const t = now();
    return S.positions.map((p) => { const s = snaps.get(p.mint); const ok = fresh(s, t); const ref = ok ? s.priceUsd : p.lastMark; const val = ref > 0 ? estExitValue(cfg.paper, p.qty, ref, ok ? s.metrics.liquidityUsd : p.lastLiq) : 0;
      return { ...p, mark: ref, markAt: ok ? s.observedAt : p.lastMarkAt, markStale: !ok, estExitUsd: r2(val), unrealizedUsd: r2(val - p.cost), gainPct: ref > 0 ? r2((ref / p.entryPrice - 1) * 100) : null, pendingSell: S.pending.some((o) => o.positionId === p.id) }; });
  }
  function agentRows() {
    return agents().map((a) => { const st = stat(a.id); const f = FAMILIES.find((x) => x.id === a.fam);
      return { key: a.id, id: a.id, name: a.name, fam: a.fam, lin: f?.lineage || a.fam, rule: a.conditions.map(condText).join(' · '), conditions: a.conditions, enabled: a.enabled, builtin: a.builtin, votes: st.votes, quorums: st.quorums, fills: st.fills, checks: st.checks, missing: st.missing, pnl: r2(st.pnl), note: a.note || '' }; });
  }
  function saveCustom(input) {
    const v = validateAgent(input); if (!v.ok) return { ok: false, errors: v.errors };
    const ex = input.id ? S.customAgents.find((a) => a.id === input.id) : S.customAgents.find((a) => a.name.toLowerCase() === v.agent.name.toLowerCase());
    const running = S.customAgents.filter((a) => a.enabled && a !== ex).length;
    if (v.agent.enabled && running >= cfg.agents.customSlots) return { ok: false, errors: [`All ${cfg.agents.customSlots} custom slots are running. Stop one first.`] };
    if (!ex && input.id) return { ok: false, errors: ['No such agent.'] };
    const a = ex ? Object.assign(ex, v.agent) : { id: 'custom.' + id('a'), createdAt: now(), ...v.agent };
    if (!ex) S.customAgents.push(a);
    led({ kind: 'agent', who: a.id, coin: '', usd: null, note: `${ex ? 'Updated' : 'Created'} custom agent "${a.name}": ${a.conditions.map(condText).join(' · ')} (${a.enabled ? 'voting' : 'stopped'})` });
    save(S); return { ok: true, agent: a };
  }
  function setCustomEnabled(aid, on) {
    const a = S.customAgents.find((x) => x.id === aid); if (!a) return { ok: false, errors: ['No such agent.'] };
    if (on && !a.enabled && S.customAgents.filter((x) => x.enabled).length >= cfg.agents.customSlots) return { ok: false, errors: [`All ${cfg.agents.customSlots} custom slots are running. Stop one first.`] };
    a.enabled = !!on; led({ kind: 'agent', who: a.id, coin: '', usd: null, note: `Custom agent "${a.name}" ${on ? 'started' : 'stopped'}.` }); save(S); return { ok: true, agent: a };
  }
  function deleteCustom(aid) {
    const a = S.customAgents.find((x) => x.id === aid); if (!a) return { ok: false, errors: ['No such agent.'] };
    S.customAgents = S.customAgents.filter((x) => x !== a); led({ kind: 'agent', who: a.id, coin: '', usd: null, note: `Custom agent "${a.name}" deleted.` }); save(S); return { ok: true };
  }
  function pause() { if (!S.paused) { S.paused = true; for (const o of S.pending.filter((o) => o.side === 'buy')) cancel(o, 'desk paused'); led({ kind: 'control', who: 'you', coin: '', usd: null, note: 'Desk paused: no new paper buys. Exits on open paper positions keep running.' }); save(S); emit('status', status()); } return { ok: true, paused: true }; }
  function resume() { if (S.paused) { S.paused = false; led({ kind: 'control', who: 'you', coin: '', usd: null, note: 'Desk resumed.' }); save(S); emit('status', status()); } return { ok: true, paused: false }; }
  function reset(confirm) {
    if (confirm !== 'RESET') return { ok: false, errors: ['To reset, send {"confirm":"RESET"}. This erases the paper account, positions, ledger and quorum history (custom agents are kept).'] };
    const keep = S.customAgents; const fresh2 = freshState(cfg, now(), keep); for (const k of Object.keys(S)) delete S[k]; Object.assign(S, fresh2);
    led({ kind: 'control', who: 'you', coin: '', usd: null, note: `Paper account reset to ${cfg.paper.startingCashUsd} virtual USD.` }); save(S); emit('status', status()); return { ok: true };
  }
  return { state: S, snaps, feed, tick, status, markets, positions, agentRows, saveCustom, setCustomEnabled, deleteCustom, pause, resume, reset, families: () => FAMILIES, isBusy: () => busy };
}
