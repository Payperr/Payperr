// =====================================================================================
//  site.config.js  ·  LOOK AND WORDING of the dashboard (name, colors, fonts, page labels).
//  Trading settings (watchlist, virtual cash, fees, risk limits, exits) are NOT here:
//  they live in paper.config.json next to START.bat and are enforced by the local server.
//  Presets in /presets/*.js can override any subset of these keys (?preset=name).
// =====================================================================================
export default {
  preset: null,

  brand: {
    name: 'Payper',
    ticker: 'PAYPER',
    tagline: 'a paper-trading record on live market data',
    description: 'Paper trading on live DexScreener data for Solana tokens. Rule-based agents vote; a paper trade is recorded only when a quorum forms and every risk check passes. Virtual USD only.',
    logo: { type: 'image', src: '/img/mark.svg', text: 'P' },
    favicon: '/img/mark.svg',
  },

  chain: { name: 'Solana', unit: 'USD' },  // all paper amounts are virtual US dollars

  // Greenbar: ink on fan-fold paper. These tokens also colour the canvases (sparklines,
  // equity line, gauges, coin chart). Status never relies on colour alone: every state
  // also has a word, a sign (+/−, ✓/✗) or a shape.
  theme: {
    bg: '#cfcab9', pn: '#fbfbf6', pn2: '#fbfbf6', bg3: '#dcebd6',
    ln: '#cdd5c6', ln2: '#b9c4b2', ln3: '#8f9c88',
    tx: '#1f231d', ink2: '#363d33', mu: '#4a5545', dim: '#5b6556',
    acc: '#2b4a33', acc2: '#1f231d', up: '#1f5a34', dn: '#a2372e', warn: '#7a5410',
    onAcc: '#fbfbf6',
  },

  // Courier Prime (SIL OFL 1.1), regular/italic/bold/bold italic, is declared in
  // css/greenbar.css from /fonts. No remote font service is used.
  fonts: {
    mono: { family: 'Courier Prime', src: '', stack: "'Courier New',Courier,monospace" },
    sans: { family: 'Courier Prime', src: '', stack: "'Courier New',Courier,monospace" },
    stylesheet: '',
  },

  // Order = nav order. enabled:false hides a page. na:true marks a page UNAVAILABLE
  // in the nav; such pages stay visible on purpose so it is clear what this version does NOT do.
  pages: [
    { id: 'desk',     label: 'Desk',          short: 'Desk',    icon: 'desk',     enabled: true, description: 'From live quote to paper fill, one observation at a time' },
    { id: 'proof',    label: 'Proof',         short: 'Proof',   icon: 'proof',    enabled: true, description: 'Each quorum as filed: votes, observed values, quote age, risk checks, order' },
    { id: 'backtest', label: 'Backtest',      short: 'Test',    icon: 'backtest', enabled: true, na: true, description: 'Unavailable: no recorded price history to replay' },
    { id: 'agents',   label: 'Agents',        short: 'Agents',  icon: 'agents',   enabled: true, description: 'Define a rule from feed metrics; read the record of every agent' },
    { id: 'narr',     label: 'Narratives',    short: 'Metas',   icon: 'narr',     enabled: true, na: true, description: 'Unavailable: theme tracking is not part of this version' },
    { id: 'devhunt',  label: 'Dev hunt',      short: 'Devs',    icon: 'devhunt',  enabled: true, na: true, description: 'Unavailable: developer-wallet data is not in the feed' },
    { id: 'lab',      label: 'Lab',           short: 'Lab',     icon: 'lab',      enabled: true, na: true, description: 'Unavailable: strategy search is not part of this version' },
    { id: 'ledger',   label: 'Ledger',        short: 'Ledger',  icon: 'ledger',   enabled: true, description: 'Every paper entry in order: buys, sells, cancellations, desk actions' },
    { id: 'wallets',  label: 'Paper account', short: 'Account', icon: 'wallets',  enabled: true, description: 'Virtual cash, paper positions, pending orders and the rules in force' },
  ],

  social: [],

  footer: {
    enabled: true,
    text: '{name} ({ticker}) · Paper trading only, in virtual USD · Real trading is not implemented · Market data: DexScreener public API · Not investment advice',
    links: [{ label: 'DexScreener API docs', url: 'https://docs.dexscreener.com/api/reference' }],
  },

  labels: {
    stages: [['WATCH', 'valid quotes'], ['CHECK', 'rules tested'], ['QUORUM', 'formed'], ['RISK DESK', 'cleared'], ['PAPER FILL', 'open'], ['EXITS', 'paper sells']],
    kpis: { pnl: 'Paper P&amp;L · USD', eq: 'Paper equity', cash: 'Virtual cash', open: 'Open positions', age: 'Quote age', dec: 'Rule checks' },
  },

  data: {
    streamPath: '/api/stream',
    pollMs: 10000,           // how often panels re-read the local server
  },

  copy: {
    'common.srcLive': 'LIVE FEED',
    'common.srcPaper': 'PAPER · virtual',
    'common.srcUnavailable': 'UNAVAILABLE',
    'common.unavailable': 'Not available in this version.',
    'common.modeLive': '<b>Paper record</b> · Prices are live from DexScreener. Every balance, position and trade here is <b>virtual</b>.',
    'common.modeShared': '<b>Shared demonstration</b> · One read-only <b>paper</b> account, the same for every visitor. Virtual USD, <b>not your wallet</b>. Prices are live from DexScreener.',
    'common.mixed': 'Not live: {n} section(s)',
    'desk.pipelineTitle': 'Decision path',
    'desk.pipelineSub': 'read left to right · a paper trade clears every gate on one observation',
    'desk.strategies': 'Strategy families',
    'desk.dialHint': 'hover for detail · select a family to filter',
  },
};
