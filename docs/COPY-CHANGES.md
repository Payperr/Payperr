# Payper copy changes: the editorial rewrite

**Date:** 11 November 2026 (Asia/Manila)
**Base source:** GitHub `Payperr/Payperr`, branch `main`, commit `b74df16136c2c9a5100da9f34eea95309a4fe28c` ("Add files via upload", 11 Nov 2026 16:51 Manila). The commit holds only the 11 root files, and all 11 match the local Payper package byte for byte. `public/`, `server/`, `tests/` and `docs/` are **not in the repository**, so the rest of the source came from the last local Payper package (`payper-greenbar.zip`).
**Scope:** website text only. Layout, features, numbers, risk rules, API behaviour and security are unchanged.
**Research basis:** see `docs/COPY-RESEARCH.md`.

## The voice in one paragraph

Payper now writes like a methods note from a careful research desk. Short declarative sentences say what was observed, which rule applied and what was recorded. Every number carries its qualifier (paper, virtual USD, simulated fill, estimate). Missing features are named as missing, with a reason. Claims stay within what the site itself knows: its own configuration and the data it retrieved. The copy never describes what a visitor might gain. The premium feel comes from precision and restraint, not adjectives.

## Highlights: before and after

| Where | Before | After |
|---|---|---|
| Browser title | Loading… (replaced by script after load) | Payper · a paper-trading record on live market data (in the HTML, so crawlers and link previews see it) |
| Tagline | paper-trading consensus desk | a paper-trading record on live market data |
| Meta / social description | empty `<meta name="description" content="">`; no Open Graph tags | Paper trading on live DexScreener data for Solana tokens. Rule-based agents vote; a paper trade is recorded only when a quorum forms and every risk check passes. Virtual USD only. |
| Run-mode card (local) | **Paper trading** · market data is live from DexScreener; every balance, position and trade is **virtual**. | **Paper record** · Prices are live from DexScreener. Every balance, position and trade here is **virtual**. |
| Run-mode card (public) | **Shared demonstration** · one read-only **paper** account for every visitor, virtual USD, **not your wallet**. Market data is live from DexScreener. | **Shared demonstration** · One read-only **paper** account, the same for every visitor. Virtual USD, **not your wallet**. Prices are live from DexScreener. |
| Desk page intro | Live market feed → agent votes → quorum → risk desk → paper fills | From live quote to paper fill, one observation at a time |
| Proof page intro | Every quorum with its evidence, quote age, risk checks and paper order | Each quorum as filed: votes, observed values, quote age, risk checks, order |
| Token panel (no address) | No PAYPER token or contract address exists yet. An address that claims to be PAYPER right now is not from this project. This website works today as a paper-trading desk (virtual money only) and does not need any token. | No token address has been published on this site. Verify the official address before trading. (Label stays NOT LAUNCHED YET; its tooltip reads "No token address is configured on this site".) |
| Token panel (address set) | This is the PAYPER mint address set by the site owner. Before you use it anywhere, compare it character by character with the official announcement: a format check cannot prove a token is genuine. | Address configured by the site operator and checked for format only. Verify it against the official announcement before trading. |
| Read-only notice | **SHARED DEMONSTRATION · READ-ONLY** This public site shows one shared **paper** account in virtual USD. It is **not your wallet** and not anyone's real money. Nobody can pause, reset or change it from the web. There is no wallet sign-in. To build your own agents, run Payper on your own computer. | **SHARED DEMONSTRATION · READ-ONLY** One **paper** account in virtual USD, the same for every visitor. It is **not your wallet**. Nothing here can be changed from the web, and there is no wallet sign-in. To define your own agents, run Payper on your own computer. |
| Unavailable pages | Unavailable in this version | Unavailable: no recorded price history to replay (each page gives its own reason), plus "No results are shown. This feature is not available." |
| Footer | {name} ({ticker}) · PAPER TRADING ONLY · virtual USD · real trading is not implemented · market data: DexScreener public API · not financial advice | {name} ({ticker}) · Paper trading only, in virtual USD · Real trading is not implemented · Market data: DexScreener public API · Not investment advice |
| Section names | Trading pipeline · Strategies · Coins in play · Activity & performance | Decision path · Strategy families · Tokens in play · Activity and record |
| Data-source tooltip | Real market data from DexScreener via your local server (wrong on the public site) | names this site's own server (correct in both modes) |

The exact before and after text for every change is in the inventory below.

## Changed files (relative to the repository root)

- `public/index.html`: static title, meta description, Open Graph tags, section names, empty states, notices, token panel, accessibility labels
- `public/site.config.js`: tagline, description, page intros, mode cards, footer, labels
- `public/js/app.js`: runtime banners, toasts, tooltips, empty states, Proof explanation, builder messages, unavailable explanations
- `server/app.mjs`: UNAVAILABLE reasons, read-only reason, and the token `check` text returned by `/api/project` (now "No token address is configured on this site.")
- `server/strategies.mjs`: strategy-family descriptions (shown in the UI)
- `preview.html`: regenerated with the same copy (still marked DESIGN PREVIEW · EXAMPLE DATA ONLY)
- `tests/public.test.mjs`: the SPA-fallback check now looks for the new static title instead of "Loading". The check is equally strict.
- `tests/copy.test.mjs` (new): bans hype and performance vocabulary, checks title and description lengths, header-slot lengths and the "Unavailable" prefix, and requires the PAPER and virtual labels
- `package.json`, `TEST.bat`: run the new copy test with the others
- `docs/COPY-RESEARCH.md`, `docs/COPY-CHANGES.md` (new)

## What did not change

- Every number: starting cash, sizes, quorum, fees, slippage, stale-quote limit, daily loss limit and all 12 risk checks
- PAPER / virtual USD labels, `NOT LAUNCHED YET`, and the `UNAVAILABLE` / `LIVE FEED` / `PAPER · virtual` source badges
- The public site's read-only behaviour, with no wallet connect, keys, signing or real orders
- The token rule: shown as not launched until a valid contract address is configured. No address was invented.
- Engine labels for risk checks and rule fields (already precise; they are functional strings)

## Layout review (by code; no browser was used)

- Page intros are at most 80 characters (enforced by `tests/copy.test.mjs`). The longest is 75 characters ("Each quorum as filed…"), against 72 before. These sit in an italic 12–13 px line that wraps, so they cannot overflow.
- Decision-card status lines (`.cs`, clamped to 2 lines) are at most 56 characters (enforced).
- The run-mode card is slightly longer than before; the read-only notice and token panel are now shorter than the originals. All are wrapping block text with no clamp or fixed height.
- The title is 52 characters (at most 60, enforced). The meta description is 179 characters (120–200, enforced).
- **Visual rendering was not checked.** No browser or headless browser was run, per instructions. A jsdom smoke test of both modes rendered the new title, mode card, footer and NOT LAUNCHED YET state with no console errors.

## Tests

`npm test`: 57 of 57 pass (the 51 existing tests plus 6 copy-discipline tests). No safety assertion was removed or loosened.

## Pass 2: editorial correction (11 Nov 2026)

A review found three faults in pass 1, all now fixed:

1. **Unsupported certainty about the token.** Pass 1 said no PAYPER token exists anywhere and that any other address "does not come from this project". The site cannot know either; it only knows its own configuration. The copy now says only that no address has been published *on this site*. The NOT LAUNCHED YET label stays (tests require it), with a tooltip saying it reflects this site's setup.
2. **A misleading denial.** "Nothing here is simulated" sat on a site whose paper fills *are* simulated. Unavailable pages now read "No results are shown. This feature is not available."
3. **"Fresh quote" could be read as the last trade.** It now reads "recent" or "recently retrieved" quote. The engine's age limit is unchanged, and the risk-check label "Quote fresh" (an engine string with its own seconds shown) is unchanged.

Pass 2 also cut verbosity and absolute wording. The page description went from 263 to 179 characters. The read-only notice, the API read-only reason and several empty states are shorter. "Never asks… never sends" became the literal "does not ask… sends no transactions". "Will carry no promise" about a hypothetical future token became "Payper makes no promise of earnings, fees or a share in any token." The new copy test forbids the corrected phrases from coming back.

### Pass 2 inventory (32 replacements; counts above 1 mean the same string appeared several times)

| # | File | Before (pass 1 text) | After (final) |
|---|---|---|---|
| 1 | `public/index.html` | Payper tests rule-based agents against live DexScreener quotes for Solana tokens. A paper trade is recorded only when agents from separate strategy families agree on one fresh quote and every risk check passes. All balances are virtual US dollars. | Paper trading on live DexScreener data for Solana tokens. Rule-based agents vote; a paper trade is recorded only when a quorum forms and every risk check passes. Virtual USD only. (×2) |
| 2 | `public/index.html` | NOT LAUNCHED YET | NOT LAUNCHED YET |
| 3 | `public/index.html` | No PAYPER token exists and no contract address has been issued. Any address presented as PAYPER today does not come from this project. The site needs no token: it is a paper-trading record kept in virtual money. | No token address has been published on this site. Verify the official address before trading. |
| 4 | `public/index.html` | A future PAYPER token would carry no promise of earnings, fees or a share in anything. | Payper makes no promise of earnings, fees or a share in any token. |
| 5 | `public/index.html` | This page shows one paper account, the same for every visitor, kept in virtual USD. It is not your wallet and holds no one's money. It cannot be paused, reset or edited from the web, and there is no wallet sign-in. To define your own agents, run Payper on your own computer. | One paper account in virtual USD, the same for every visitor. It is not your wallet. Nothing here can be changed from the web, and there is no wallet sign-in. To define your own agents, run Payper on your own computer. |
| 6 | `public/index.html` | Nothing recorded yet. The log stays empty until agents agree; that is normal. | Nothing recorded yet. Entries appear when agents agree. |
| 7 | `public/index.html` | No paper trades yet. A trade is recorded only when a quorum forms and every risk check passes. | No paper trades yet. One is recorded when a quorum forms and every risk check passes. |
| 8 | `public/index.html` | No quorum has formed yet. On a quiet market that is expected; the desk does not manufacture one. | No quorum has formed yet. On a quiet market, that is expected. |
| 9 | `public/index.html` | An agent is a set of conditions on metrics the market feed actually reports. When every condition holds on a fresh quote, | An agent is a set of conditions on metrics the market feed reports. When every condition holds on a recently retrieved quote, |
| 10 | `public/index.html` | Payper never asks for a wallet address, seed phrase or private key, and never sends a transaction. | This site does not ask for a wallet address, seed phrase or private key, and sends no transactions. |
| 11 | `public/site.config.js` | description: 'Payper tests rule-based agents against live DexScreener quotes for Solana tokens. A paper trade is recorded only when agents from separate strategy families agree on one fresh quote and every risk check passes. All balances are virtual US dollars.' | description: 'Paper trading on live DexScreener data for Solana tokens. Rule-based agents vote; a paper trade is recorded only when a quorum forms and every risk check passes. Virtual USD only.' |
| 12 | `public/site.config.js` | 'common.unavailable': 'Not part of this version. The space is left blank rather than filled with estimates.' | 'common.unavailable': 'Not available in this version.' |
| 13 | `public/js/app.js` | exits wait for a fresh quote | exits wait for a newer quote |
| 14 | `public/js/app.js` | families, one fresh quote` | families, one recent quote` |
| 15 | `public/js/app.js` | on a fresh quote. It votes as the “Your agents” family. | on a recently retrieved quote. It votes as the “Your agents” family. |
| 16 | `public/js/app.js` | tokens with fresh quotes match right now (latest poll) | tokens with recent quotes match (latest poll) |
| 17 | `public/js/app.js` | 'A backtest needs recorded market history and a replay engine; this version has neither. Rather than show estimated results, the page is left blank. The Proof and Ledger pages hold the paper record as it happened.' | 'No results are shown. A backtest needs recorded price history, which this version does not keep.' |
| 18 | `public/js/app.js` | 'Left blank on purpose. Nothing here is simulated.' | 'No results are shown. This feature is not available.' (×3) |
| 19 | `public/js/app.js` | 'Contract address set by the site operator. Check it character by character against the official announcement before you use it anywhere; a format check cannot prove a token is genuine.' | 'Address configured by the site operator and checked for format only. Verify it against the official announcement before trading.' |
| 20 | `public/js/app.js` | $('token-state').textContent = 'CONTRACT ADDRESS'; | $('token-state').textContent = 'CONTRACT ADDRESS'; $('token-state').removeAttribute('title'); |
| 21 | `server/app.mjs` | check: 'No PAYPER token exists yet. Any address claiming to be PAYPER right now is not from this project.' | check: 'No token address is configured on this site.' |
| 22 | `server/app.mjs` | 'This public Payper site is read-only. It shows one shared demonstration paper account in virtual USD, not your wallet. Nothing can be paused, reset or changed from the web. To define your own agents, run Payper on your own computer with START.bat.' | 'This public site is read-only: one shared paper account in virtual USD, not your wallet. To define your own agents, run Payper on your own computer.' |
| 23 | `preview.html (generator)` | one fresh quote | one recent quote |
| 24 | `preview.html (generator)` | An agent is a set of conditions on metrics the market feed actually reports. When every condition holds on a fresh quote, | An agent is a set of conditions on metrics the market feed reports. When every condition holds on a recently retrieved quote, |
| 25 | `preview.html (generator)` | on a fresh quote. It votes as the “Your agents” family. | on a recently retrieved quote. It votes as the “Your agents” family. |
| 26 | `preview.html (generator)` | tokens with fresh quotes match right now (example) | tokens with recent quotes match (example) |
| 27 | `preview.html (generator)` | No PAYPER token exists and no contract address has been issued. Any address presented as PAYPER today does not come from this project. The working app needs no token: it is a paper-trading record kept in virtual money. | No token address has been published on this site. Verify the official address before trading. |
| 28 | `preview.html (generator)` | A future PAYPER token would carry no promise of earnings, fees or a share in anything. Real trading is not implemented. | Payper makes no promise of earnings, fees or a share in any token. Real trading is not implemented. |
| 29 | `preview.html (generator)` | NOT LAUNCHED YET | NOT LAUNCHED YET |
| 30 | `preview.html (generator)` | 'Left blank on purpose. The Proof and Ledger pages hold the paper record as it happened.' | 'No results are shown. The Proof and Ledger pages hold the paper record.' |
| 31 | `preview.html (generator)` | 'Left blank on purpose. Nothing here is simulated.' | 'No results are shown. This feature is not available.' (×3) |
| 32 | `preview.html (generator)` | Payper never asks for a wallet address, seed phrase or private key, and never sends a transaction. | This site does not ask for a wallet address, seed phrase or private key, and sends no transactions. |

## Pass 1 inventory (every replacement, in order; rows changed again in pass 2 are superseded by the table above)

| # | File | Before | After |
|---|---|---|---|
| 1 | `public/index.html` | Loading… | Payper · a paper-trading record on live market data |
| 2 | `public/index.html` | Read-only public site: desk controls are off. | Public site · read-only. Desk controls are off. |
| 3 | `public/index.html` | SHARED DEMONSTRATION · READ-ONLY This public site shows one shared paper account in virtual USD. It is not your wallet and not anyone's real money. Nobody can pause, reset or change it from the web. There is no wallet sign-in. To build your own agents, run Payper on your own computer. | SHARED DEMONSTRATION · READ-ONLY This page shows one paper account, the same for every visitor, kept in virtual USD. It is not your wallet and holds no one's money. It cannot be paused, reset or edited from the web, and there is no wallet sign-in. To define your own agents, run Payper on your own computer. |
| 4 | `public/index.html` | No PAYPER token or contract address exists yet. An address that claims to be PAYPER right now is not from this project. This website works today as a paper-trading desk (virtual money only) and does not need any token. | No PAYPER token exists and no contract address has been issued. Any address presented as PAYPER today does not come from this project. The site needs no token: it is a paper-trading record kept in virtual money. |
| 5 | `public/index.html` | Owning a future PAYPER token is not promised to give earnings, fees or a share of anything. | A future PAYPER token would carry no promise of earnings, fees or a share in anything. |
| 6 | `public/index.html` | Trading pipeline | Decision path |
| 7 | `public/index.html` | Strategies | Strategy families |
| 8 | `public/index.html` | clear filter × | Clear filter × |
| 9 | `public/index.html` | aria-label="Printed wheel of strategy families, one hatched segment per family, sized by agent count. Click a segment to filter votes; the Families list below does the same from the keyboard." | aria-label="Printed wheel of strategy families: one hatched segment per family, sized by its number of agents. Select a segment to filter votes; the Families list below offers the same filter from the keyboard." |
| 10 | `public/index.html` | waiting for the first market poll | awaiting the first market poll |
| 11 | `public/index.html` | waiting for an agent vote | no vote yet |
| 12 | `public/index.html` | each agent checks its rules against the latest quote | each agent tests its rule against the latest quote |
| 13 | `public/index.html` | deterministic checks before any paper order | fixed checks, run before any paper order |
| 14 | `public/index.html` | Coins in play | Tokens in play |
| 15 | `public/index.html` | Waiting for the first quotes… | Awaiting the first quotes. |
| 16 | `public/index.html` | latest rule checks | latest rule tests, newest first |
| 17 | `public/index.html` | condition held · ×failed · ?data missing · rows = agent checks (newest first) · columns = conditions | condition held · ×failed · ?no data · rows: agent checks, newest first · columns: conditions |
| 18 | `public/index.html` | across the tokens you track, from the latest DexScreener poll | tracked tokens · latest DexScreener poll |
| 19 | `public/index.html` | Activity & performance | Activity and record |
| 20 | `public/index.html` | Nothing yet. An empty log is normal until agents agree. | Nothing recorded yet. The log stays empty until agents agree; that is normal. |
| 21 | `public/index.html` | No paper trades yet. Trades only happen when a quorum forms and every risk check passes. | No paper trades yet. A trade is recorded only when a quorum forms and every risk check passes. |
| 22 | `public/index.html` | every quorum with its evidence and risk decision | every quorum, its evidence and the risk decision |
| 23 | `public/index.html` | No quorum has formed yet. That is expected on a quiet market: the desk never invents one. | No quorum has formed yet. On a quiet market that is expected; the desk does not manufacture one. |
| 24 | `public/index.html` | Pick a quorum to see which agents voted, every condition with its observed value and data source, the quote age, each risk check and the resulting paper order. | Select a quorum to read which agents voted, each condition with its observed value and source, the quote age, every risk check and the resulting paper order. |
| 25 | `public/index.html` | Your agent is a set of conditions over metrics the market feed really provides. When all conditions hold on a fresh quote it votes, as its own family (“Your agents”), in the same quorum as the built-in agents. Size and exits are set by the desk in paper.config.json. | An agent is a set of conditions on metrics the market feed actually reports. When every condition holds on a fresh quote, it votes as the “Your agents” family, in the same quorum as the built-in agents. Trade size and exits apply to the whole desk and are set in paper.config.json. |
| 26 | `public/index.html` | placeholder="name it" maxlength="32" | placeholder="Agent name" maxlength="32" |
| 27 | `public/index.html` | Votes when ALL of these hold | Votes only when all of these hold |
| 28 | `public/index.html` | + condition | + Condition |
| 29 | `public/index.html` | What can't be used, and why | Metrics not available, and why |
| 30 | `public/index.html` | No agent yet. Build one on the left. | No agents yet. Define one with the form on this page. |
| 31 | `public/index.html` | Third-party holder agents belong to a hosted platform. This local paper app has none. | Holder agents run on third-party hosted platforms. Payper does not connect to any of them. |
| 32 | `public/index.html` | placeholder="agent, family or rule" | placeholder="Agent, family or rule" |
| 33 | `public/index.html` | “Attrib. P&L” splits each closed paper trade's realized P&L equally among the agents that voted for it. Paper only. | “Attrib. P&L” divides the realized P&L of each closed paper trade equally among the agents that voted for it. Paper figures only. |
| 34 | `public/index.html` | placeholder="coin, agent or note" | placeholder="Token, agent or note" |
| 35 | `public/index.html` | Every row is a PAPER record. Amounts are virtual USD; fills are simulated estimates, not executions. There are no on-chain transactions. | Every row is a PAPER entry. Amounts are virtual USD; fills are simulated estimates, not executions. No row has an on-chain transaction. |
| 36 | `public/index.html` | Pausing stops new paper buys; exits on open paper positions keep running. Reset erases positions, ledger and quorum history (your agents are kept) and needs confirmation. | Pausing stops new paper buys; exits on open positions continue. Reset clears positions, the ledger and quorum history, keeps your agents, and asks for confirmation. |
| 37 | `public/index.html` | No pending orders. Orders fill at the next newer quote, at the worse of the decision and next price. | No pending orders. An order fills at the next newer quote, at the worse of the decision price and that quote. |
| 38 | `public/index.html` | Paper trading uses no wallet. This app never asks for a wallet address, seed phrase or private key and never sends a transaction. | Paper trading uses no wallet. Payper never asks for a wallet address, seed phrase or private key, and never sends a transaction. |
| 39 | `public/index.html` | This erases all paper positions, pending orders, the ledger and quorum history and sets virtual cash back to the starting amount. Your custom agents are kept. Type RESET to confirm. | This clears every paper position, pending order, ledger entry and quorum record, and returns virtual cash to the starting amount. Your agents are kept. Type RESET to confirm. |
| 40 | `public/site.config.js` | tagline: 'paper-trading consensus desk', | tagline: 'a paper-trading record on live market data', |
| 41 | `public/site.config.js` | description: 'Rule-based agents read live DexScreener market data for Solana tokens, vote, and only trades that pass a cross-family quorum and deterministic risk checks are paper-traded with virtual USD.', | description: 'Payper tests rule-based agents against live DexScreener quotes for Solana tokens. A paper trade is recorded only when agents from separate strategy families agree on one fresh quote and every risk check passes. All balances are virtual US dollars.', |
| 42 | `public/site.config.js` | logo: { type: 'image', src: '/img/mark.svg', text: 'S' }, | logo: { type: 'image', src: '/img/mark.svg', text: 'P' }, |
| 43 | `public/site.config.js` | description: 'Live market feed → agent votes → quorum → risk desk → paper fills' } | description: 'From live quote to paper fill, one observation at a time' } |
| 44 | `public/site.config.js` | description: 'Every quorum with its evidence, quote age, risk checks and paper order' } | description: 'Each quorum as filed: votes, observed values, quote age, risk checks, order' } |
| 45 | `public/site.config.js` | label: 'Backtest', short: 'Test', icon: 'backtest', enabled: true, na: true, description: 'Unavailable in this version' } | label: 'Backtest', short: 'Test', icon: 'backtest', enabled: true, na: true, description: 'Unavailable: no recorded price history to replay' } |
| 46 | `public/site.config.js` | description: 'Build your own rule agent and inspect every agent\'s record' } | description: 'Define a rule from feed metrics; read the record of every agent' } |
| 47 | `public/site.config.js` | label: 'Narratives', short: 'Metas', icon: 'narr', enabled: true, na: true, description: 'Unavailable in this version' } | label: 'Narratives', short: 'Metas', icon: 'narr', enabled: true, na: true, description: 'Unavailable: theme tracking is not part of this version' } |
| 48 | `public/site.config.js` | label: 'Lab', short: 'Lab', icon: 'lab', enabled: true, na: true, description: 'Unavailable in this version' } | label: 'Lab', short: 'Lab', icon: 'lab', enabled: true, na: true, description: 'Unavailable: strategy search is not part of this version' } |
| 49 | `public/site.config.js` | description: 'Every paper buy, sell, cancellation and desk action' } | description: 'Every paper entry in order: buys, sells, cancellations, desk actions' } |
| 50 | `public/site.config.js` | description: 'Virtual cash, paper positions, pending orders and controls' } | description: 'Virtual cash, paper positions, pending orders and the rules in force' } |
| 51 | `public/site.config.js` | text: '{name} ({ticker}) · PAPER TRADING ONLY · virtual USD · real trading is not implemented · market data: DexScreener public API · not financial advice', | text: '{name} ({ticker}) · Paper trading only, in virtual USD · Real trading is not implemented · Market data: DexScreener public API · Not investment advice', |
| 52 | `public/site.config.js` | stages: [['WATCH', 'valid quotes'], ['CHECK', 'rule checks'], ['QUORUM', 'formed'], ['RISK DESK', 'passed'], ['PAPER FILL', 'open'], ['EXITS', 'paper sells']], | stages: [['WATCH', 'valid quotes'], ['CHECK', 'rules tested'], ['QUORUM', 'formed'], ['RISK DESK', 'cleared'], ['PAPER FILL', 'open'], ['EXITS', 'paper sells']], |
| 53 | `public/site.config.js` | 'common.unavailable': 'Not available in this version. Nothing is simulated or invented here.', | 'common.unavailable': 'Not part of this version. The space is left blank rather than filled with estimates.', |
| 54 | `public/site.config.js` | 'common.modeLive': 'Paper trading · market data is live from DexScreener; every balance, position and trade is virtual.', | 'common.modeLive': 'Paper record · Prices are live from DexScreener. Every balance, position and trade here is virtual.', |
| 55 | `public/site.config.js` | 'common.modeShared': 'Shared demonstration · one read-only paper account for every visitor, virtual USD, not your wallet. Market data is live from DexScreener.', | 'common.modeShared': 'Shared demonstration · One read-only paper account, the same for every visitor. Virtual USD, not your wallet. Prices are live from DexScreener.', |
| 56 | `public/site.config.js` | 'common.mixed': '{n} section(s) not live', | 'common.mixed': 'Not live: {n} section(s)', |
| 57 | `public/site.config.js` | 'desk.pipelineTitle': 'Trading pipeline', | 'desk.pipelineTitle': 'Decision path', |
| 58 | `public/site.config.js` | 'desk.pipelineSub': 'each observation moves left to right; a paper trade needs every step', | 'desk.pipelineSub': 'read left to right · a paper trade clears every gate on one observation', |
| 59 | `public/site.config.js` | 'desk.strategies': 'Strategies', | 'desk.strategies': 'Strategy families', |
| 60 | `public/site.config.js` | 'desk.dialHint': 'hover the ring · click a family to filter', | 'desk.dialHint': 'hover for detail · select a family to filter', |
| 61 | `public/js/app.js` | const SRC_TITLE = { live: 'Real market data from DexScreener via your local server', paper: 'Virtual paper-trading data: no real money, no real orders', unavailable: 'Not available in this version' }; | const SRC_TITLE = { live: 'Market data from DexScreener, fetched by this site\'s own server', paper: 'Virtual account data. No real money, no real orders.', unavailable: 'Not part of this version' }; |
| 62 | `public/js/app.js` | 'Cannot reach the Payper server right now. Numbers on this page may be out of date; it retries automatically.' | 'The Payper server is not responding. Figures on this page may be out of date; the page reconnects on its own.' |
| 63 | `public/js/app.js` | 'Cannot reach the local server. Is the Payper START window still open? Numbers on this page may be out of date.' | 'The local server is not responding. Check that the Payper START window is still open. Figures on this page may be out of date.' |
| 64 | `public/js/app.js` | msg = `Market feed is not answering (${f.lastError?.message \|\| 'no successful poll yet'}). No paper buys can happen. The server retries automatically with backoff.`; | msg = `Market feed unavailable (${f.lastError?.message \|\| 'no successful poll yet'}). No paper buys can be made until it returns. The server retries automatically, at increasing intervals.`; |
| 65 | `public/js/app.js` | msg = `Market quotes are stale (last good poll ${ago(f.lastOkAt)} ago). New paper buys are halted; open positions keep their last known price, marked stale, and exits wait for a fresh quote.`; | msg = `Quotes are stale: last good poll ${ago(f.lastOkAt)} ago. New paper buys are halted. Open positions are held at their last known price, marked stale, and exits wait for a fresh quote.`; |
| 66 | `public/js/app.js` | msg = `Daily loss limit reached for ${s.desk.dayKey} (${s.desk.dayTimeZone}). New paper buys resume at the next ${s.desk.dayTimeZone} midnight.`; | msg = `Daily loss limit reached for ${s.desk.dayKey} (${s.desk.dayTimeZone}). New paper buys resume at midnight, ${s.desk.dayTimeZone} time.`; |
| 67 | `public/js/app.js` | msg = 'Desk paused by you: no new paper buys. Exits on open paper positions keep running.'; | msg = 'Desk paused by you. No new paper buys; exits on open positions continue.'; |
| 68 | `public/js/app.js` | 'running · read-only public site: controls are off' | 'running · public site is read-only' |
| 69 | `public/js/app.js` | toast(r.paused ? 'Paused: no new paper buys.' : 'Resumed.') | toast(r.paused ? 'Paused. No new paper buys.' : 'Resumed. New paper buys are allowed.') |
| 70 | `public/js/app.js` | toast('Not reset: you must type RESET.') | toast('Not reset. Type RESET to confirm.') |
| 71 | `public/js/app.js` | toast(r.ok ? 'Paper account reset.' : r.errors[0]) | toast(r.ok ? 'Paper account reset to starting cash.' : r.errors[0]) |
| 72 | `public/js/app.js` | const MK = [['trk', 'Tracked', 'tokens with a quote / tokens requested'], ['h1', 'Median 1h', 'median priceChange.h1 across tracked tokens'], ['m5', 'Median 5m', 'median priceChange.m5'], ['buy', 'Buy share 5m', 'median buys / (buys + sells), last 5 minutes'], ['vol', 'Volume 1h', 'sum of volume.h1 across tracked tokens, USD'], ['age', 'Oldest quote', 'age of the oldest quote (observation time = HTTP Date − Age)']]; | const MK = [['trk', 'Tracked', 'Tokens with a valid quote / tokens requested'], ['h1', 'Median 1h', 'Median 1-hour price change across tracked tokens (priceChange.h1)'], ['m5', 'Median 5m', 'Median 5-minute price change (priceChange.m5)'], ['buy', 'Buy share 5m', 'Median buys ÷ (buys + sells), last 5 minutes'], ['vol', 'Volume 1h', 'Sum of 1-hour volume across tracked tokens, USD'], ['age', 'Oldest quote', 'Age of the oldest quote; observed time = HTTP Date − Age']]; |
| 73 | `public/js/app.js` | title="where these numbers come from" | title="Where these figures come from" |
| 74 | `public/js/app.js` | click to filter` | select to filter` |
| 75 | `public/js/app.js` | ' — showing only these' | ' · filtered view' |
| 76 | `public/js/app.js` | `quorum = ${q.minVotes} votes from ${q.minFamilies}+ families on one fresh quote` | `quorum: ${q.minVotes} votes, ${q.minFamilies}+ families, one fresh quote` |
| 77 | `public/js/app.js` | 'price history builds up while this page is open' | 'price history accumulates while this page is open' |
| 78 | `public/js/app.js` | $('pf-title').textContent = 'Quorum not found'; $('pf-body').innerHTML = 'This quorum is not in the history (it may have been reset).'; | $('pf-title').textContent = 'Quorum not found'; $('pf-body').innerHTML = 'This quorum is no longer in the history; the account may have been reset.'; |
| 79 | `public/js/app.js` | voted on the same DexScreener observation of ${esc(q.sym)}${q.state === 'buy' ? ', every risk check passed, and a paper order was placed to fill at the next newer quote at the worse of the two prices.' : `. The risk desk denied it: ${esc(q.why)}.`} | voted on one DexScreener observation of ${esc(q.sym)}${q.state === 'buy' ? '. Every risk check passed, and a paper order was placed to fill at the next newer quote, at the worse of the two prices.' : `. The risk desk declined it: ${esc(q.why)}.`} |
| 80 | `public/js/app.js` | The price is DexScreener's reference price, not an executable quote. Paper orders have no transaction.` | The price is DexScreener's reference price, not an executable quote. A paper order has no transaction.` |
| 81 | `public/js/app.js` | 'No condition yet.' | 'No conditions yet.' |
| 82 | `public/js/app.js` | Its vote counts as the “Your agents” family.` : 'Add at least one condition.'; | It votes as the “Your agents” family.` : 'Add at least one condition.'; |
| 83 | `public/js/app.js` | 'Name it first.' | 'Give the agent a name first.' |
| 84 | `public/js/app.js` | toast(`${r.agent.name} saved: it votes from the next poll.`) | toast(`${r.agent.name} saved. It votes from the next poll.`) |
| 85 | `public/js/app.js` | 'Nothing matches.' : 'The ledger is empty. Rows appear when the desk places, fills or cancels paper orders.' | 'No entries match.' : 'The ledger is empty. Entries appear when the desk places, fills or cancels a paper order.' |
| 86 | `public/js/app.js` | No agent matches. | No agents match. |
| 87 | `public/js/app.js` | 'A backtest would need recorded historical market snapshots and a replay engine. Rather than show invented results, this page stays empty. Watch the Proof and Ledger pages to judge the desk on its real paper record.' | 'A backtest needs recorded market history and a replay engine; this version has neither. Rather than show estimated results, the page is left blank. The Proof and Ledger pages hold the paper record as it happened.' |
| 88 | `public/js/app.js` | 'Nothing on this page is simulated.' | 'Left blank on purpose. Nothing here is simulated.' |
| 89 | `public/js/app.js` | $('ctl-state').textContent = 'read-only public site: controls are off'; | $('ctl-state').textContent = 'public site is read-only'; |
| 90 | `public/js/app.js` | sv.textContent = 'Saving is off on the public site'; sv.title = 'The public site is read-only. Run Payper on your own computer to build agents.'; | sv.textContent = 'Saving is disabled on the public site'; sv.title = 'This public site is read-only. Run Payper on your own computer to define agents.'; |
| 91 | `public/js/app.js` | $('token-body').textContent = 'This is the PAYPER mint address set by the site owner. Before you use it anywhere, compare it character by character with the official announcement: a format check cannot prove a token is genuine.'; | $('token-body').textContent = 'Contract address set by the site operator. Check it character by character against the official announcement before you use it anywhere; a format check cannot prove a token is genuine.'; |
| 92 | `public/js/app.js` | toast('Contract address copied.') | toast('Address copied.') |
| 93 | `public/js/app.js` | toast('Press Ctrl+C to copy the selected address.') | toast('Address selected. Press Ctrl+C to copy.') |
| 94 | `server/app.mjs` | '/api/backtest': 'No historical candles are fetched, so no backtest is computed. Nothing is invented.', | '/api/backtest': 'No price history is recorded, so no backtest is computed and none is shown.', |
| 95 | `server/app.mjs` | '/api/bots/all': 'There are no third-party holder agents in a local paper app.', | '/api/bots/all': 'Third-party holder agents are not connected to Payper.', |
| 96 | `server/app.mjs` | '/api/chainbook': 'Paper trades have no on-chain transactions, so there is no chain book.', | '/api/chainbook': 'Paper trades create no on-chain transactions, so there is no chain record to show.', |
| 97 | `server/app.mjs` | '/api/narratives': 'Narrative / meta tracking is not implemented in this version.', | '/api/narratives': 'Theme and narrative tracking is not part of this version.', |
| 98 | `server/app.mjs` | '/api/devhunt': 'Developer-wallet data is not available from the DexScreener feed.', | '/api/devhunt': 'Developer-wallet data is not available in the DexScreener feed.', |
| 99 | `server/app.mjs` | '/api/lab': 'Strategy search / breeding is not implemented in this version.', | '/api/lab': 'Automated strategy search is not part of this version.', |
| 100 | `server/app.mjs` | const READ_ONLY_REASON = 'This public Payper site is read-only. It shows one shared demonstration paper account (virtual USD, not your wallet); nobody can pause, reset or change it from the web. To build your own agents, run Payper on your own computer with START.bat.'; | const READ_ONLY_REASON = 'This public Payper site is read-only. It shows one shared demonstration paper account in virtual USD, not your wallet. Nothing can be paused, reset or changed from the web. To define your own agents, run Payper on your own computer with START.bat.'; |
| 101 | `server/strategies.mjs` | about: 'Price is rising on both the 5-minute and 1-hour windows.' | about: 'Price rising on both the 5-minute and 1-hour windows.' |
| 102 | `server/strategies.mjs` | about: '5-minute volume is running hotter than the 1-hour pace.' | about: 'Five-minute volume running ahead of the hourly pace.' |
| 103 | `server/strategies.mjs` | about: 'Buys outnumber sells in the recent transaction count.' | about: 'Buys outnumber sells in recent transaction counts.' |
| 104 | `server/strategies.mjs` | about: 'Down on the day but turning up in the last hour.' | about: 'Down on the day, turning up within the hour.' |
| 105 | `server/strategies.mjs` | about: 'Young pair (minutes to a day old) with real liquidity and positive short-term move.' | about: 'A young pair, minutes to a day old, with measurable liquidity and a positive short-term move.' |
| 106 | `server/strategies.mjs` | about: 'Agents you build on the Agents page. They vote like any other family.' | about: 'Agents you define on the Agents page. They vote on equal terms with every other family.' |
| 107 | `preview.html (generator)` | ['desk', 'Desk', 'Live market feed → agent votes → quorum → risk desk → paper fills'] | ['desk', 'Desk', 'From live quote to paper fill, one observation at a time'] |
| 108 | `preview.html (generator)` | ['proof', 'Proof', 'Every quorum with its evidence, quote age, risk checks and paper order'] | ['proof', 'Proof', 'Each quorum as filed: votes, observed values, quote age, risk checks, order'] |
| 109 | `preview.html (generator)` | ['backtest', 'Backtest', 'Unavailable in this version', 1] | ['backtest', 'Backtest', 'Unavailable: no recorded price history to replay', 1] |
| 110 | `preview.html (generator)` | ['agents', 'Agents', "Build your own rule agent and inspect every agent's record"] | ['agents', 'Agents', 'Define a rule from feed metrics; read the record of every agent'] |
| 111 | `preview.html (generator)` | ['narr', 'Narratives', 'Unavailable in this version', 1] | ['narr', 'Narratives', 'Unavailable: theme tracking is not part of this version', 1] |
| 112 | `preview.html (generator)` | ['lab', 'Lab', 'Unavailable in this version', 1] | ['lab', 'Lab', 'Unavailable: strategy search is not part of this version', 1] |
| 113 | `preview.html (generator)` | ['ledger', 'Ledger', 'Every paper buy, sell, cancellation and desk action'] | ['ledger', 'Ledger', 'Every paper entry in order: buys, sells, cancellations, desk actions'] |
| 114 | `preview.html (generator)` | ['wallets', 'Paper account', 'Virtual cash, paper positions, pending orders and controls'] | ['wallets', 'Paper account', 'Virtual cash, paper positions, pending orders and the rules in force'] |
| 115 | `preview.html (generator)` | each observation moves left to right; a paper trade needs every step | read left to right · a paper trade clears every gate on one observation |
| 116 | `preview.html (generator)` | hover the ring · click a family to filter | hover for detail · select a family to filter |
| 117 | `preview.html (generator)` | latest rule checks | latest rule tests, newest first |
| 118 | `preview.html (generator)` | across the tokens you track, from the latest DexScreener poll | tracked tokens · latest DexScreener poll |
| 119 | `preview.html (generator)` | every quorum with its evidence and risk decision | every quorum, its evidence and the risk decision |
| 120 | `preview.html (generator)` | “Attrib. P&L” splits each closed paper trade's realized P&L equally among the agents that voted for it. Paper only. | “Attrib. P&L” divides the realized P&L of each closed paper trade equally among the agents that voted for it. Paper figures only. |
| 121 | `preview.html (generator)` | Every row is a PAPER record. Amounts are virtual USD; fills are simulated estimates, not executions. | Every row is a PAPER entry. Amounts are virtual USD; fills are simulated estimates, not executions. |
| 122 | `preview.html (generator)` | Paper trading uses no wallet. This app never asks for a wallet address, seed phrase or private key and never sends a transaction. | Paper trading uses no wallet. Payper never asks for a wallet address, seed phrase or private key, and never sends a transaction. |
| 123 | `preview.html (generator)` | Third-party holder agents belong to a hosted platform. This local paper app has none. | Holder agents run on third-party hosted platforms. Payper does not connect to any of them. |
| 124 | `preview.html (generator)` | , every risk check passed, and a paper order was placed to fill at the next newer quote at the worse of the two prices. | . Every risk check passed, and a paper order was placed to fill at the next newer quote, at the worse of the two prices. |
| 125 | `preview.html (generator)` | Votes when ALL of these hold | Votes only when all of these hold |
| 126 | `preview.html (generator)` | Momentum — showing only these | Momentum · filtered view |
| 127 | `preview.html (generator)` | data missing · rows = agent checks (newest first) · columns = conditions | no data · rows: agent checks, newest first · columns: conditions |
| 128 | `preview.html (generator)` | There are no third-party holder agents in a local paper app. | Third-party holder agents are not connected to Payper. |
| 129 | `preview.html (generator)` | Paper trades have no on-chain transactions, so there is nothing to show here. | Paper trades create no on-chain transactions, so there is no chain record to show. |
| 130 | `preview.html (generator)` | Your agent is a set of conditions over metrics the market feed really provides. When all conditions hold on a fresh quote it | An agent is a set of conditions on metrics the market feed actually reports. When every condition holds on a fresh quote, it |
| 131 | `preview.html (generator)` | , as its own family (“Your agents”), in the same quorum as the built-in agents. | as the “Your agents” family, in the same quorum as the built-in agents. |
| 132 | `preview.html (generator)` | Its vote counts as the “Your agents” family. | It votes as the “Your agents” family. |
| 133 | `preview.html (generator)` | Example of the running and paused button states. Pausing stops new paper buys; exits keep running. | Example of the running and paused button states. Pausing stops new paper buys; exits on open positions continue. |
| 134 | `preview.html (generator)` | EXAMPLE DATA ONLY · not connected to any market feed or to your paper account · nothing here is live, real money or a real trade. | EXAMPLE DATA ONLY · not connected to any market feed or paper account · nothing on this page is live, real money or a real trade. |
| 135 | `preview.html (generator)` | Paper trading · in the working app market data is live from DexScreener; every balance, position and trade is virtual. This preview shows example data. | Paper record · In the working app, prices are live from DexScreener and every balance, position and trade is virtual. This preview shows example data. |
| 136 | `preview.html (generator)` | No PAYPER token or contract address exists yet. An address that claims to be PAYPER right now is not from this project. The working app is a paper-trading desk (virtual money only) and does not need any token. | No PAYPER token exists and no contract address has been issued. Any address presented as PAYPER today does not come from this project. The working app needs no token: it is a paper-trading record kept in virtual money. |
| 137 | `preview.html (generator)` | Owning a future PAYPER token is not promised to give earnings, fees or a share of anything. Real trading is not implemented. | A future PAYPER token would carry no promise of earnings, fees or a share in anything. Real trading is not implemented. |
| 138 | `preview.html (generator)` | Example of a notice line: when quotes go stale, new paper buys halt and this line explains why. (Design preview: no feed is connected.) | Example notice line: when quotes go stale, new paper buys halt and this line states why. (Design preview: no feed is connected.) |
| 139 | `preview.html (generator)` | Payper (PAYPER) · DESIGN PREVIEW · example data only · PAPER TRADING ONLY in the working app · real trading is not implemented · not financial advice | Payper (PAYPER) · DESIGN PREVIEW · example data only · The working app trades on paper only, in virtual USD · Real trading is not implemented · Not investment advice |
| 140 | `preview.html (generator)` | >Trading pipeline< | >Decision path< |
| 141 | `preview.html (generator)` | >Strategies< | >Strategy families< |
| 142 | `preview.html (generator)` | >Coins in play< | >Tokens in play< |
| 143 | `preview.html (generator)` | >Activity & performance< | >Activity and record< |
| 144 | `preview.html (generator)` |  |  |
| 145 | `preview.html` | 'No historical candles are fetched, so no backtest is shown.', 'Rather than show invented results, this page stays empty.' | 'No price history is recorded, so no backtest is computed and none is shown.', 'Left blank on purpose. The Proof and Ledger pages hold the paper record as it happened.' |
| 146 | `preview.html` | 'Narrative / meta tracking is not implemented in this version.', 'Nothing on this page is simulated.' | 'Theme and narrative tracking is not part of this version.', 'Left blank on purpose. Nothing here is simulated.' |
| 147 | `preview.html` | 'Developer-wallet data is not available from the DexScreener API.', 'Nothing on this page is simulated.' | 'Developer-wallet data is not available in the DexScreener feed.', 'Left blank on purpose. Nothing here is simulated.' |
| 148 | `preview.html` | 'Strategy search / breeding is not implemented in this version.', 'Nothing on this page is simulated.' | 'Automated strategy search is not part of this version.', 'Left blank on purpose. Nothing here is simulated.' |
