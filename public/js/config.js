// Loads site.config.js, merges the selected preset (?preset=name or config.preset), and exposes helpers.
import base from '/site.config.js';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function merge(a, b) { const o = { ...a }; for (const k in b) o[k] = isObj(a?.[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k]; return o; }
const qs = new URLSearchParams(location.search);
const presetName = (qs.get('preset') || base.preset || '').replace(/[^a-z0-9_-]/gi, '');
let preset = {};
if (presetName) { try { preset = (await import(`/presets/${presetName}.js`)).default; } catch (e) { console.warn(`[config] preset "${presetName}" not found`); } }
export const CFG = merge(base, preset);
export const PRESET = presetName;

// "{name} {ticker} {year}" → values from the config
export function fill(str, extra = {}) {
  return String(str ?? '').replace(/\{([\w.]+)(:n)?\}/g, (m, path, n) => {
    const ctx = { name: CFG.brand.name, ticker: CFG.brand.ticker, year: new Date().getFullYear(), p: CFG.params, chain: CFG.chain, ...extra };
    const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), ctx);
    return v == null ? m : n ? Number(v).toLocaleString('en-US') : v;
  });
}
export const t = (key, extra) => fill(CFG.copy[key] ?? key, extra);
export const P = CFG.params;
export const unit = CFG.chain.unit;
export const pagesOn = CFG.pages.filter((p) => p.enabled !== false);
