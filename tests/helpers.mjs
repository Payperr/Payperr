// TEST FIXTURES ONLY. These synthetic DexScreener-shaped pairs never reach the live UI.
import { normalizePair } from '../server/market.mjs';
import { validateConfig, DEFAULTS } from '../server/config.mjs';

export const A1 = 'So11111111111111111111111111111111111111112';
export const A2 = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
export const A3 = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

export function pair(addr, sym, o = {}) {
  return {
    chainId: 'solana', dexId: 'testdex', url: 'https://dexscreener.com/solana/testpair' + sym.toLowerCase(), pairAddress: 'PAIR' + sym,
    baseToken: { address: addr, name: sym + ' token', symbol: sym }, quoteToken: { address: A1, name: 'Wrapped SOL', symbol: 'SOL' },
    priceUsd: String(o.price ?? 1), priceNative: '0.01',
    txns: { m5: { buys: o.b5 ?? 40, sells: o.s5 ?? 20 }, h1: { buys: o.b1 ?? 300, sells: o.s1 ?? 280 }, h6: { buys: 1, sells: 1 }, h24: { buys: 1, sells: 1 } },
    volume: { m5: o.volM5 ?? 10000, h1: o.volH1 ?? 60000, h6: 300000, h24: 900000 },
    priceChange: 'priceChange' in o ? o.priceChange : { m5: o.m5 ?? 0.8, h1: o.h1 ?? 3, h6: o.h6 ?? 2, h24: o.h24 ?? 1 },
    liquidity: 'liq' in o && o.liq === null ? null : { usd: o.liq ?? 200000, base: 1, quote: 1 },
    fdv: 'fdv' in o ? o.fdv : 5e6, marketCap: 'mc' in o ? o.mc : 4e6, pairCreatedAt: o.created ?? 1600000000000,
  };
}
// A "strong" pair satisfies momentum.1, volume.1 and pressure.1 (3 families).
export const strong = (addr = A2, sym = 'JUP', o = {}) => pair(addr, sym, o);
// A pair that only satisfies momentum (no volume pace, no buy pressure).
export const weak = (addr = A3, sym = 'BONK', o = {}) => pair(addr, sym, { b5: 10, s5: 30, b1: 100, s1: 200, volM5: 1000, volH1: 100000, ...o });

// Fake market: script(tickIndex, now) -> array of raw pairs. Each tick produces a NEW observation.
export function fakeMarket(script, clock, { failAt = new Set() } = {}) {
  let i = 0; const state = { requests: 0, rateLimited: 0 };
  return {
    state, calls: () => i,
    async quotes(addresses) {
      const k = i++; state.requests++;
      if (failAt.has(k)) return { ok: false, snaps: new Map(), errors: ['HTTP 503'] };
      const t = clock.now(); const snaps = new Map();
      for (const p of script(k, t)) if (addresses.includes(p.baseToken.address)) snaps.set(p.baseToken.address, normalizePair(p, { fetchedAt: t, observedAt: t, endpoint: '/tokens/v1 (fixture)' }));
      return { ok: true, snaps, errors: [] };
    },
    async discover() { return { ok: true, addresses: [], errors: [] }; },
  };
}
export function clock(start = Date.UTC(2026, 10, 11, 2, 0, 0)) { const c = { t: start, now: () => c.t, advance: (ms) => (c.t += ms) }; return c; }
export function testConfig(over = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULTS));
  base.market.watchlist = [{ symbol: 'SOL', address: A1 }, { symbol: 'JUP', address: A2 }, { symbol: 'BONK', address: A3 }];
  const merge = (a, b) => { for (const k in b) a[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return a; };
  const v = validateConfig(merge(base, over)); if (!v.ok) throw new Error(v.errors.join('\n')); return v.config;
}
