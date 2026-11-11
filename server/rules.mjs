// The metric catalogue and the condition evaluator shared by built-in and custom agents.
// Only metrics that DexScreener actually returns (or that are derived from them with a
// formula shown below) exist here. A metric that is missing/null in a snapshot makes the
// condition "missing" and the agent does NOT vote (fail closed).

const SRC = 'DexScreener /tokens/v1';
export const FIELDS = {
  priceUsd:     { label: 'Price (USD)', unit: '$', min: 0, max: 1e9, src: SRC + ' priceUsd' },
  liquidityUsd: { label: 'Liquidity (USD)', unit: '$', min: 0, max: 1e12, src: SRC + ' liquidity.usd' },
  marketCap:    { label: 'Market cap (USD)', unit: '$', min: 0, max: 1e13, src: SRC + ' marketCap (never replaced by FDV)' },
  fdv:          { label: 'Fully diluted value (USD)', unit: '$', min: 0, max: 1e13, src: SRC + ' fdv' },
  chgM5:        { label: 'Price change 5 min', unit: '%', min: -100, max: 100000, src: SRC + ' priceChange.m5' },
  chgH1:        { label: 'Price change 1 h', unit: '%', min: -100, max: 100000, src: SRC + ' priceChange.h1' },
  chgH6:        { label: 'Price change 6 h', unit: '%', min: -100, max: 100000, src: SRC + ' priceChange.h6' },
  chgH24:       { label: 'Price change 24 h', unit: '%', min: -100, max: 100000, src: SRC + ' priceChange.h24' },
  volM5:        { label: 'Volume 5 min (USD)', unit: '$', min: 0, max: 1e12, src: SRC + ' volume.m5' },
  volH1:        { label: 'Volume 1 h (USD)', unit: '$', min: 0, max: 1e12, src: SRC + ' volume.h1' },
  volH6:        { label: 'Volume 6 h (USD)', unit: '$', min: 0, max: 1e12, src: SRC + ' volume.h6' },
  volH24:       { label: 'Volume 24 h (USD)', unit: '$', min: 0, max: 1e12, src: SRC + ' volume.h24' },
  txnsM5:       { label: 'Transactions 5 min', unit: 'count', min: 0, max: 1e9, src: SRC + ' txns.m5.buys + sells' },
  txnsH1:       { label: 'Transactions 1 h', unit: 'count', min: 0, max: 1e9, src: SRC + ' txns.h1.buys + sells' },
  buyShareM5:   { label: 'Buy share of txns 5 min', unit: '0-1', min: 0, max: 1, src: 'derived: txns.m5.buys / (buys + sells)' },
  buyShareH1:   { label: 'Buy share of txns 1 h', unit: '0-1', min: 0, max: 1, src: 'derived: txns.h1.buys / (buys + sells)' },
  volAccel:     { label: '5-min volume vs 1-h pace', unit: 'x', min: 0, max: 1e6, src: 'derived: volume.m5 × 12 / volume.h1' },
  pairAgeMin:   { label: 'Pair age (minutes)', unit: 'min', min: 0, max: 1e8, src: 'derived: retrieval time − pairCreatedAt' },
  liqToMcap:    { label: 'Liquidity / market cap', unit: 'ratio', min: 0, max: 1e6, src: 'derived: liquidity.usd / marketCap (null when marketCap is missing)' },
};
// Things people expect from launchpad dashboards that this feed cannot supply. Builder
// requests using them are rejected with these reasons instead of being silently ignored.
export const UNSUPPORTED = {
  devHold: 'Developer wallet holdings are not in the DexScreener feed.', devSold: 'Developer sells are not in the DexScreener feed.',
  holders: 'Holder counts are not in the DexScreener feed.', top10: 'Top-holder concentration is not in the DexScreener feed.',
  snipers: 'Sniper / block-0 data is not in the DexScreener feed.', bundled: 'Bundle detection is not in the DexScreener feed.',
  curve: 'Bonding-curve progress is not in the DexScreener feed.', phase: 'Launchpad phase (curve/pool) is not in the DexScreener feed.',
  callers: 'Caller / KOL wallets are not tracked.', smartWallets: 'Wallet-level data is not tracked.', athDrop: 'All-time-high is not in the DexScreener feed.',
  slots: 'Slot-level timing is not available; quotes are polled every few seconds.', socials: 'Social sentiment is not read by this app.',
  size: 'Trade size is set by the desk (paper.tradeSizeUsd), not per agent.', takeProfit: 'Exits are set by the desk (exits.* in paper.config.json), not per agent.',
  stopLoss: 'Exits are set by the desk (exits.* in paper.config.json), not per agent.', trailing: 'Exits are set by the desk (exits.* in paper.config.json), not per agent.',
};
export const OPS = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b };

const fmt = (v, unit) => v == null ? 'missing' : unit === '%' ? v.toFixed(2) + ' %' : unit === '$' ? '$' + Math.round(v).toLocaleString('en-US') : unit === '0-1' || unit === 'ratio' || unit === 'x' ? v.toFixed(3) : String(Math.round(v * 100) / 100);
export const condText = (c) => `${FIELDS[c.field]?.label || c.field} ${c.op} ${fmt(c.value, FIELDS[c.field]?.unit)}`;

// -> { pass, results:[{ c, field, op, value, v, ok(true|false|null), src, at }] }
export function evaluate(conditions, snap) {
  const results = conditions.map((c) => {
    const f = FIELDS[c.field]; const raw = snap?.metrics?.[c.field];
    const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    const ok = v == null ? null : OPS[c.op](v, c.value);
    return { c: condText(c), field: c.field, op: c.op, value: c.value, v: fmt(v, f?.unit), raw: v, ok, src: f?.src || 'unknown', at: snap?.observedAt ?? null };
  });
  return { pass: results.length > 0 && results.every((r) => r.ok === true), missing: results.filter((r) => r.ok === null).length, results };
}

const NAME = /^[A-Za-z0-9 ._-]{1,32}$/;
// Validates a custom agent definition from the builder. Returns { ok, agent } or { ok:false, errors }.
export function validateAgent(input, { maxConditions = 8 } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['Agent must be a JSON object.'] };
  const allowed = new Set(['id', 'name', 'conditions', 'enabled', 'note']);
  for (const k of Object.keys(input)) if (!allowed.has(k)) errors.push(UNSUPPORTED[k] ? `Unsupported field "${k}": ${UNSUPPORTED[k]}` : `Unknown field "${k}" is not supported.`);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!NAME.test(name)) errors.push('Name must be 1–32 characters: letters, digits, space, dot, dash or underscore.');
  const conds = input.conditions;
  if (!Array.isArray(conds) || conds.length < 1) errors.push('Add at least one condition.');
  else if (conds.length > maxConditions) errors.push(`At most ${maxConditions} conditions.`);
  const out = [];
  (Array.isArray(conds) ? conds : []).slice(0, maxConditions).forEach((c, i) => {
    if (!c || typeof c !== 'object') return errors.push(`Condition ${i + 1} is not an object.`);
    const extra = Object.keys(c).filter((k) => !['field', 'op', 'value'].includes(k)); if (extra.length) errors.push(`Condition ${i + 1}: unknown key(s) ${extra.join(', ')}.`);
    const f = FIELDS[c.field];
    if (!f) return errors.push(UNSUPPORTED[c.field] ? `Condition ${i + 1}: "${c.field}" is unsupported: ${UNSUPPORTED[c.field]}` : `Condition ${i + 1}: unknown metric "${c.field}".`);
    if (!OPS[c.op]) return errors.push(`Condition ${i + 1}: operator must be one of ${Object.keys(OPS).join(' ')}.`);
    const v = typeof c.value === 'string' && c.value.trim() !== '' ? Number(c.value) : c.value;
    if (typeof v !== 'number' || !Number.isFinite(v)) return errors.push(`Condition ${i + 1}: value must be a finite number.`);
    if (v < f.min || v > f.max) return errors.push(`Condition ${i + 1}: ${f.label} value must be between ${f.min} and ${f.max}.`);
    out.push({ field: c.field, op: c.op, value: v });
  });
  if (input.enabled != null && typeof input.enabled !== 'boolean') errors.push('enabled must be true or false.');
  if (input.note != null && (typeof input.note !== 'string' || input.note.length > 140)) errors.push('note must be text up to 140 characters.');
  if (errors.length) return { ok: false, errors };
  return { ok: true, agent: { name, conditions: out, enabled: input.enabled !== false, note: (input.note || '').trim() } };
}
