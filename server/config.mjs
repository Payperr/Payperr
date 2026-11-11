// Loads and validates paper.config.json. Every number is checked to be finite and inside a
// sane range; anything invalid stops startup with a plain-English list of what to fix.
import fs from 'node:fs';

export const DEFAULTS = {
  port: 8787,
  // PAYPER contract (mint) address shown on the site. Empty = "NOT LAUNCHED YET". Checked in deploy.mjs.
  contractAddress: '',
  market: {
    pollSeconds: 30, maxQuoteAgeSeconds: 90, requestTimeoutMs: 8000,
    watchlist: [],
    discovery: { enabled: false, maxTokens: 10, refreshMinutes: 5, sources: ['token-boosts-latest', 'token-profiles-latest'] },
  },
  paper: { startingCashUsd: 10000, tradeSizeUsd: 100, reserveUsd: 500, feeBps: 100, slippageBps: 150, flatFeeUsd: 0.5, priceImpactModel: true, maxPctOfLiquidity: 2 },
  quorum: { minVotes: 3, minFamilies: 3 },
  risk: { minLiquidityUsd: 50000, maxOpenPositions: 6, maxExposureUsd: 600, maxBuysPerHour: 4, dailyLossLimitUsd: 150, cooldownMinutes: 60, dayTimeZone: 'Asia/Manila' },
  exits: { takeProfit: [{ atPct: 8, sellPct: 50 }, { atPct: 16, sellPct: 50 }], stopLossPct: 6, trailingPct: 5, trailingArmPct: 6, maxHoldMinutes: 240 },
  agents: { customSlots: 3 },
};

// [path, min, max, integer?]
const NUMS = [
  ['port', 1024, 65535, true],
  ['market.pollSeconds', 30, 3600], ['market.maxQuoteAgeSeconds', 15, 3600], ['market.requestTimeoutMs', 1000, 60000, true],
  ['market.discovery.maxTokens', 0, 22, true], ['market.discovery.refreshMinutes', 2, 1440],
  ['paper.startingCashUsd', 100, 1e9], ['paper.tradeSizeUsd', 1, 1e8], ['paper.reserveUsd', 0, 1e9],
  ['paper.feeBps', 0, 1000], ['paper.slippageBps', 0, 2000], ['paper.maxPctOfLiquidity', 0.01, 10], ['paper.flatFeeUsd', 0, 1000],
  ['quorum.minVotes', 1, 50, true], ['quorum.minFamilies', 1, 10, true],
  ['risk.minLiquidityUsd', 0, 1e12], ['risk.maxOpenPositions', 1, 100, true], ['risk.maxExposureUsd', 1, 1e9],
  ['risk.maxBuysPerHour', 1, 100, true], ['risk.dailyLossLimitUsd', 1, 1e9], ['risk.cooldownMinutes', 0, 10080],
  ['exits.stopLossPct', 0.5, 95], ['exits.trailingPct', 0.5, 95], ['exits.trailingArmPct', 0, 1000], ['exits.maxHoldMinutes', 1, 100000],
  ['agents.customSlots', 0, 10, true],
];
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(a, b) { const o = { ...a }; for (const k in b) { if (k.startsWith('_')) continue; o[k] = isObj(a?.[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k]; } return o; }
const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isMint = (s) => typeof s === 'string' && BASE58.test(s);

export function validateConfig(raw) {
  const errors = [];
  if (!isObj(raw)) return { ok: false, errors: ['The settings file must contain a JSON object { ... }.'] };
  const known = new Set(Object.keys(DEFAULTS));
  for (const k of Object.keys(raw)) if (!k.startsWith('_') && !known.has(k)) errors.push(`Unknown setting "${k}" (not used by this app; remove it).`);
  const c = merge(DEFAULTS, raw);
  for (const [p, min, max, int] of NUMS) {
    const v = get(c, p);
    if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${p} must be a number (got ${JSON.stringify(v)}).`);
    else if (v < min || v > max) errors.push(`${p} must be between ${min} and ${max} (got ${v}).`);
    else if (int && !Number.isInteger(v)) errors.push(`${p} must be a whole number (got ${v}).`);
  }
  try { new Intl.DateTimeFormat('en-CA', { timeZone: c.risk.dayTimeZone }); } catch { errors.push(`risk.dayTimeZone "${c.risk.dayTimeZone}" is not a valid IANA time zone (example: Asia/Manila).`); }
  if (typeof c.paper.priceImpactModel !== 'boolean') errors.push('paper.priceImpactModel must be true or false.');
  if (typeof c.market.discovery.enabled !== 'boolean') errors.push('market.discovery.enabled must be true or false.');
  const okSrc = new Set(['token-boosts-latest', 'token-profiles-latest']);
  if (!Array.isArray(c.market.discovery.sources) || c.market.discovery.sources.some((s) => !okSrc.has(s))) errors.push(`market.discovery.sources may only contain ${[...okSrc].join(', ')}.`);
  if (!Array.isArray(c.market.watchlist)) errors.push('market.watchlist must be a list.');
  else {
    if (c.market.watchlist.length > 30) errors.push('market.watchlist can hold at most 30 tokens.');
    const seen = new Set();
    c.market.watchlist.forEach((w, i) => {
      if (!isObj(w) || !isMint(w.address)) errors.push(`market.watchlist[${i}].address is not a Solana token address.`);
      else if (seen.has(w.address)) errors.push(`market.watchlist[${i}] is listed twice.`); else seen.add(w.address);
    });
  }
  if (!c.market.watchlist?.length && !c.market.discovery.enabled) errors.push('Nothing to watch: add tokens to market.watchlist or set market.discovery.enabled to true.');
  if (c.quorum.minFamilies > c.quorum.minVotes) errors.push('quorum.minFamilies cannot be larger than quorum.minVotes.');
  if (c.paper.tradeSizeUsd > c.risk.maxExposureUsd) errors.push('paper.tradeSizeUsd is larger than risk.maxExposureUsd, so no trade could ever pass.');
  if (c.paper.tradeSizeUsd + c.paper.reserveUsd > c.paper.startingCashUsd) errors.push('paper.tradeSizeUsd + paper.reserveUsd is more than paper.startingCashUsd.');
  const tp = c.exits.takeProfit;
  if (!Array.isArray(tp) || tp.length > 6) errors.push('exits.takeProfit must be a list of up to 6 steps.');
  else {
    let sum = 0, prev = 0;
    tp.forEach((s, i) => {
      if (!isObj(s) || !Number.isFinite(s.atPct) || !Number.isFinite(s.sellPct)) { errors.push(`exits.takeProfit[${i}] needs numbers atPct and sellPct.`); return; }
      if (s.atPct <= 0 || s.atPct > 10000) errors.push(`exits.takeProfit[${i}].atPct must be above 0.`);
      if (s.atPct <= prev) errors.push('exits.takeProfit steps must be in increasing atPct order.');
      if (s.sellPct <= 0 || s.sellPct > 100) errors.push(`exits.takeProfit[${i}].sellPct must be 1–100.`);
      prev = s.atPct; sum += s.sellPct;
    });
    if (sum > 100.0001) errors.push('exits.takeProfit sells more than 100 % in total.');
  }
  return errors.length ? { ok: false, errors } : { ok: true, config: c };
}

export function loadConfig(file) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { ok: false, errors: [e.code === 'ENOENT' ? `Settings file not found: ${file}` : `Settings file is not valid JSON: ${e.message}`] }; }
  return validateConfig(raw);
}
