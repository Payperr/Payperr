// Virtual (paper) fill and exit math. Nothing here touches a wallet or a network.
// Fill model, all values are ESTIMATES and labelled as such in the UI:
//   slippage bps = max(paper.slippageBps, 2 × notional / liquidity.usd × 10 000)  (impact term only if priceImpactModel)
//   buy : notional = spend − flatFee;  fee = notional × feeBps;  qty = (notional − fee) / (ref × (1 + slip))
//   sell: gross = qty × ref × (1 − slip);  proceeds = gross − gross × feeBps − flatFee  (never below 0)
// "ref" is the DexScreener priceUsd, which is a reference price, NOT an executable quote.
const r6 = (v) => Math.round(v * 1e6) / 1e6;

export function slippageBps(P, notional, liq) {
  let b = P.slippageBps;
  if (P.priceImpactModel && Number.isFinite(liq) && liq > 0) b = Math.max(b, (2 * notional / liq) * 1e4);
  return Math.min(b, 5000);
}
export function buyFill(P, spendUsd, refPrice, liq) {
  if (!(refPrice > 0) || !(spendUsd > P.flatFeeUsd)) return null;
  const notional = spendUsd - P.flatFeeUsd; const fee = notional * P.feeBps / 1e4; const slip = slippageBps(P, notional, liq);
  const fillPrice = refPrice * (1 + slip / 1e4); const qty = (notional - fee) / fillPrice;
  return { qty, fillPrice, refPrice, spendUsd, feeUsd: r6(fee + P.flatFeeUsd), slipBps: Math.round(slip * 10) / 10, slipUsd: r6((notional - fee) - qty * refPrice) };
}
export function sellFill(P, qty, refPrice, liq) {
  if (!(refPrice > 0) || !(qty > 0)) return null;
  const slip = slippageBps(P, qty * refPrice, liq); const fillPrice = refPrice * (1 - slip / 1e4);
  const gross = qty * fillPrice; const fee = gross * P.feeBps / 1e4; const proceeds = Math.max(0, gross - fee - P.flatFeeUsd);
  return { qty, fillPrice, refPrice, grossUsd: gross, proceedsUsd: proceeds, feeUsd: r6(fee + P.flatFeeUsd), slipBps: Math.round(slip * 10) / 10, slipUsd: r6(qty * refPrice - gross) };
}
// Estimated value if the position were sold at this reference price (after fees + slippage).
export const estExitValue = (P, qty, refPrice, liq) => (sellFill(P, qty, refPrice, liq)?.proceedsUsd ?? 0);

// Exit decisions for one position at reference price p. Returns [{ qty, reason, tpIndex? }]
// in priority order: stop loss, trailing stop and max hold close everything; take-profit
// steps sell a share of the ORIGINAL quantity.
export function exitDecision(E, pos, p, now) {
  if (!(p > 0) || !(pos.qty > 0)) return null;
  const base = pos.entryPrice; const gain = (p / base - 1) * 100;
  if (gain <= -E.stopLossPct) return { qty: pos.qty, reason: `stop loss: ${gain.toFixed(2)} % ≤ −${E.stopLossPct} %` };
  const peakGain = (pos.peak / base - 1) * 100; const fromPeak = (1 - p / pos.peak) * 100;
  if (peakGain >= E.trailingArmPct && fromPeak >= E.trailingPct) return { qty: pos.qty, reason: `trailing stop: ${fromPeak.toFixed(2)} % below peak (armed at +${E.trailingArmPct} %, peak +${peakGain.toFixed(2)} %)` };
  const heldMin = (now - pos.openedAt) / 60000;
  if (heldMin >= E.maxHoldMinutes) return { qty: pos.qty, reason: `max hold: ${heldMin.toFixed(0)} min ≥ ${E.maxHoldMinutes} min` };
  let q = 0; const steps = [];
  E.takeProfit.forEach((s, i) => { if (!pos.tpDone[i] && gain >= s.atPct) { q += pos.qty0 * s.sellPct / 100; steps.push(i); } });
  if (steps.length) { q = Math.min(q, pos.qty); if (pos.qty - q < pos.qty0 * 1e-6) q = pos.qty; return { qty: q, reason: `take profit: +${gain.toFixed(2)} % reached step ${steps.map((i) => '+' + E.takeProfit[i].atPct + ' %').join(', ')}`, tpSteps: steps }; }
  return null;
}
