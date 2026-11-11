// Built-in strategy families. Each agent is a small, named, fixed rule over observed metrics.
// Families are deliberately distinct: they read different dimensions of the same snapshot
// (trend, volume pace, order-flow share, mean reversion, pair age), so a quorum across
// several families means several independent kinds of evidence agree.
export const FAMILIES = [
  { id: 'momentum', name: 'Momentum', lineage: 'trend', hue: 190, about: 'Price rising on both the 5-minute and 1-hour windows.' },
  { id: 'volume', name: 'Volume pace', lineage: 'activity', hue: 300, about: 'Five-minute volume running ahead of the hourly pace.' },
  { id: 'pressure', name: 'Buy pressure', lineage: 'order-flow', hue: 90, about: 'Buys outnumber sells in recent transaction counts.' },
  { id: 'rebound', name: 'Dip rebound', lineage: 'mean-reversion', hue: 30, about: 'Down on the day, turning up within the hour.' },
  { id: 'early', name: 'Early pair', lineage: 'pair-age', hue: 250, about: 'A young pair, minutes to a day old, with measurable liquidity and a positive short-term move.' },
  { id: 'custom', name: 'Your agents', lineage: 'custom', hue: 55, about: 'Agents you define on the Agents page. They vote on equal terms with every other family.' },
];
const c = (field, op, value) => ({ field, op, value });
export const BUILTIN_AGENTS = [
  { id: 'momentum.1', fam: 'momentum', name: 'steady climb', conditions: [c('chgM5', '>=', 0.3), c('chgH1', '>=', 2), c('volM5', '>=', 2000)] },
  { id: 'momentum.2', fam: 'momentum', name: 'six-hour trend', conditions: [c('chgH6', '>=', 6), c('chgH1', '>=', 1), c('chgM5', '>', 0)] },
  { id: 'volume.1', fam: 'volume', name: '5m pace 1.5x', conditions: [c('volAccel', '>=', 1.5), c('volM5', '>=', 5000)] },
  { id: 'volume.2', fam: 'volume', name: 'busy hour', conditions: [c('txnsH1', '>=', 300), c('volH1', '>=', 50000), c('volAccel', '>=', 1.1)] },
  { id: 'pressure.1', fam: 'pressure', name: 'buyers lead 5m', conditions: [c('buyShareM5', '>=', 0.6), c('txnsM5', '>=', 30)] },
  { id: 'pressure.2', fam: 'pressure', name: 'buyers lead 1h', conditions: [c('buyShareH1', '>=', 0.56), c('txnsH1', '>=', 200)] },
  { id: 'rebound.1', fam: 'rebound', name: 'day dip, hour up', conditions: [c('chgH24', '<=', -8), c('chgH1', '>=', 1), c('chgM5', '>=', 0)] },
  { id: 'rebound.2', fam: 'rebound', name: '6h dip, 5m up', conditions: [c('chgH6', '<=', -5), c('chgM5', '>=', 0.5)] },
  { id: 'early.1', fam: 'early', name: 'young + liquid', conditions: [c('pairAgeMin', '>=', 10), c('pairAgeMin', '<=', 1440), c('liquidityUsd', '>=', 50000), c('chgM5', '>', 0)] },
  { id: 'early.2', fam: 'early', name: 'young + depth ratio', conditions: [c('pairAgeMin', '<=', 4320), c('liqToMcap', '>=', 0.05), c('chgH1', '>', 0)] },
];
