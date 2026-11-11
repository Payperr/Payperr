// Deterministic pre-trade checks. Every check returns its observed value and limit so the UI
// can show exactly why a quorum was allowed or denied. Order matters only for the "why" text:
// all checks are always evaluated and reported.
export function dayKey(ts, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
}
const money = (v) => '$' + (Math.round(v * 100) / 100).toLocaleString('en-US');

// ctx: { now, snap, cfg, acct:{ cash, positions, pending, buys, cooldown, paused, day }, equity, exposureUsd }
export function checkEntry(ctx) {
  const { now, snap, cfg } = ctx; const R = cfg.risk, P = cfg.paper, a = ctx.acct;
  const ageSec = snap ? (now - snap.observedAt) / 1000 : Infinity;
  const liq = snap?.metrics?.liquidityUsd; const price = snap?.priceUsd;
  const size = P.tradeSizeUsd;
  const hourBuys = a.buys.filter((t) => now - t < 3600000).length + a.pending.filter((o) => o.side === 'buy').length;
  const open = a.positions.length + a.pending.filter((o) => o.side === 'buy').length;
  const pendingBuyUsd = a.pending.filter((o) => o.side === 'buy').reduce((s, o) => s + o.spendUsd, 0);
  const lastBuy = a.cooldown[snap?.mint] || 0; const cdLeft = lastBuy + R.cooldownMinutes * 60000 - now;
  const liqCap = Number.isFinite(liq) ? liq * P.maxPctOfLiquidity / 100 : 0;
  const checks = [
    { id: 'manual', label: 'Desk not paused', ok: !a.paused, v: a.paused ? 'paused by you' : 'running', limit: 'running' },
    { id: 'dayloss', label: `Daily loss limit (${R.dayTimeZone} day)`, ok: !a.day.paused, v: a.day.paused ? `paused since ${new Date(a.day.pausedAt).toISOString()}` : `${money(ctx.dayLossUsd || 0)} lost today`, limit: money(R.dailyLossLimitUsd) },
    { id: 'price', label: 'Quote present and positive', ok: Number.isFinite(price) && price > 0, v: price == null ? 'missing' : String(price), limit: '> 0' },
    { id: 'fresh', label: 'Quote fresh', ok: Number.isFinite(ageSec) && ageSec <= cfg.market.maxQuoteAgeSeconds, v: Number.isFinite(ageSec) ? ageSec.toFixed(0) + ' s old' : 'no quote', limit: `≤ ${cfg.market.maxQuoteAgeSeconds} s` },
    { id: 'liquidity', label: 'Liquidity floor', ok: Number.isFinite(liq) && liq >= R.minLiquidityUsd, v: Number.isFinite(liq) ? money(liq) : 'missing', limit: `≥ ${money(R.minLiquidityUsd)}` },
    { id: 'sizeVsLiq', label: 'Trade small vs liquidity', ok: Number.isFinite(liq) && size <= liqCap, v: Number.isFinite(liq) ? `${(size / liq * 100).toFixed(3)} % of liquidity` : 'missing', limit: `≤ ${P.maxPctOfLiquidity} %` },
    { id: 'onePerToken', label: 'No open or pending position in this token', ok: !a.positions.some((p) => p.mint === snap?.mint) && !a.pending.some((o) => o.mint === snap?.mint), v: a.positions.some((p) => p.mint === snap?.mint) ? 'position open' : a.pending.some((o) => o.mint === snap?.mint) ? 'order pending' : 'none', limit: 'none' },
    { id: 'cooldown', label: 'Token cooldown', ok: cdLeft <= 0, v: cdLeft > 0 ? `${Math.ceil(cdLeft / 60000)} min left` : 'clear', limit: `${R.cooldownMinutes} min after last buy` },
    { id: 'openCount', label: 'Open positions', ok: open < R.maxOpenPositions, v: String(open), limit: `< ${R.maxOpenPositions}` },
    { id: 'hourly', label: 'Buys in the last 60 min', ok: hourBuys < R.maxBuysPerHour, v: String(hourBuys), limit: `< ${R.maxBuysPerHour}` },
    { id: 'exposure', label: 'Exposure after this buy (cost basis)', ok: ctx.exposureUsd + pendingBuyUsd + size <= R.maxExposureUsd + 1e-9, v: money(ctx.exposureUsd + pendingBuyUsd + size), limit: `≤ ${money(R.maxExposureUsd)}` },
    { id: 'cash', label: 'Cash covers trade + fees and keeps reserve', ok: a.cash - pendingBuyUsd - size >= P.reserveUsd - 1e-9, v: `${money(a.cash - pendingBuyUsd)} available`, limit: `${money(size)} + ${money(P.reserveUsd)} reserve` },
  ];
  const fail = checks.find((c) => !c.ok);
  return { ok: !fail, checks, why: fail ? `${fail.label}: ${fail.v} (limit ${fail.limit})` : null };
}
