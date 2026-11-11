# Payper (PAYPER) · paper-trading desk, Greenbar edition

Payper is a paper-trading desk: it reads **real market data** and trades **virtual US dollars only**. **Real trading is not implemented.** There is no wallet, no sign-in and no real order anywhere in this package.

> **PAYPER token: NOT LAUNCHED YET.** No PAYPER token or contract address exists yet, so the site shows *NOT LAUNCHED YET* and has no buy or trading links. Any address that claims to be PAYPER right now is not from this project. When the token really exists, **you** paste its contract (mint) address into one setting, and the site then shows it with a *Copy address* button and a *View on pump.fun* link. See **[docs/CONTRACT-ADDRESS.md](docs/CONTRACT-ADDRESS.md)**. A future PAYPER token is **not promised** to give earnings, fees or a share of anything, and does not unlock real trading (there is none).

**Three ways to use this folder. Pick the one you want:**

| You want to… | Open this | What it is |
|---|---|---|
| **Just see the design** | double-click **`preview.html`** | A still "look-book" of the Greenbar desk. It opens straight from disk in your browser. It needs no Node.js and no server, and makes no internet requests. **Everything in it is example data**: fictional tokens and made-up numbers, labelled *DESIGN PREVIEW · EXAMPLE DATA ONLY* at the top. Its buttons do nothing. Use the page list on the left (or at the bottom on a phone) to flip between Desk, Proof, Agents, Ledger, Paper account and an *unavailable* page. |
| **Run the working paper desk on your computer** | double-click **`START.bat`** (Windows) | The real app. It reads **live market data** from DexScreener's free public API and paper-trades with **virtual US dollars** on your computer. It opens at **http://127.0.0.1:8787/** while the black START window stays open. This **local mode** keeps the private controls (Pause, Reset, build/start/stop/delete agents) because only you can reach it: it listens on 127.0.0.1 only. |
| **Put it on the internet** | follow **[docs/DEPLOY.md](docs/DEPLOY.md)** | The same app in **public read-only mode** on a host such as Render. Visitors see one **shared demonstration** paper account (*not their wallet*). Every button that changes anything is hidden **and** the server refuses every change (HTTP 403). Nobody, including you, can pause, reset or change it from the web. There is no admin panel. Not deployed yet: the guide lists the account and payment steps that only you can do. |

> **No real money, ever.** Nothing here has a wallet. It never asks for a seed phrase, private key, wallet address, card or login. It never signs or sends a transaction or sends messages anywhere. In the working app every balance, position, profit and ledger row is **virtual** and labelled **PAPER**. Market prices are real; fills are **simulated estimates**, not what you would actually get on an exchange.

## About the Greenbar look

The desk is printed like a 1970s line-printer report on fan-fold *greenbar* paper:

- **Paper and type.** Tractor-feed holes run down both margins, and data tables have three-line mint bands. Everything is set in Courier Prime (regular, italic, bold, bold italic), shipped in `public/fonts`, so nothing loads from the internet.
- **Report structure.** Each page is a numbered *report*: the run line reads REPORT 01 · DESK … PAGE 001. The sidebar is the job card with a printed table of contents. Sections are separated by `===` and `---` rules, and the footer reads END OF REPORT.
- **Status words and shapes.** Status never relies on colour alone:
  - **PAPER** is a red rubber stamp.
  - **LIVE FEED** is a boxed label with a solid square.
  - **UNAVAILABLE** is a hatched, struck-through box. Unavailable pages also read **N/A** in the contents and **VOID** on the page.
  - The feed status box shows ■ live, ◧ starting/degraded, □ stale (dashed and hatched) or × down, and always includes the word.
  - Strategy families have their own glyph (▲ ■ ◆ ▼ ● ✚) and hatch pattern on the printed family wheel.
  - Evidence cells are ■ held, × failed or ? missing.
- **Accessibility.** Keyboard focus shows a thick blue outline. The family list, coin list and quorum list work with Enter/Space. Animation is limited to short stepped highlights and is switched off when your system asks for reduced motion.

The trading engine, risk checks, stale-feed gates, API and live stream are the same code as the earlier paper build. The Payper release added the name, the PAYPER token line and the public read-only mode.

---

## 1. Start the working app (Windows)

1. **Install Node.js** (once). Go to https://nodejs.org/, download the **LTS** version and run the installer with the default options. Any version 18 or newer should work. The build box tested Node 24 on Linux. **Windows and Node 26 were not tested.**
2. **Unzip** `payper-greenbar.zip` anywhere, for example your Desktop or Documents. Folders with spaces in their names are fine.
3. Open the unzipped `payper-greenbar` folder and **double-click `START.bat`**.
   - If Windows shows *"Windows protected your PC"*, click **More info → Run anyway**. The file is a plain text script; you can open it in Notepad to check.
4. A black window opens and says **Payper (PAYPER) is running** and **LOCAL mode**. Your browser should open by itself. If it does not, open your browser and go to:

   **http://127.0.0.1:8787/**

   If port 8787 is busy, the next free port is used. The black window prints the exact address.

Keep the black window open while you use the app.

**Stop it.** The safest way:
1. Click into the black window and press **Ctrl + C**.
2. Wait for *"Saving and stopping…"* and *"Payper has stopped"*.
3. If Windows asks *"Terminate batch job (Y/N)?"*, answer **Y**.

**Caveat about closing the window with the ✕ button.** The app saves your paper account to `data\paper-state.json` after every market poll (about every 30 s) and within a quarter of a second of every change you make: pause, reset, or an agent you save. When the console window is closed, the server also tries a final save. That final-save-on-close behaviour was **only verified on Linux. It was not tested on Windows**, and Windows can end the process within a few seconds of the window closing. In the worst case you lose the last few seconds of activity, not your account. Ctrl + C is still the recommended way to stop.

*macOS / Linux:* run `./start.sh` in a terminal (or `node server/server.mjs`), then open http://127.0.0.1:8787/.

### The first minutes are quiet — that's normal
On first start the paper account has **$10,000 virtual cash and no trades**. The app never invents trades to look busy. A paper trade only happens when at least **3 agents from 3 different families** agree on the same fresh quote **and** all 12 risk checks pass. On a calm market that can take a while.

---

## 2. What you see

Every panel carries a badge:

| Badge | Meaning |
|---|---|
| **LIVE FEED** | Real market data from DexScreener, fetched by your local server. |
| **PAPER · virtual** | Your pretend account: virtual cash, paper positions, simulated fills. |
| **UNAVAILABLE** | This version does not have this feature. Nothing is shown rather than something made up. The *Holder agents* (Agents page) and *On-chain wallets* (Paper account page) panels are unavailable too. |

The top bar also shows the **feed status** (LIVE, DEGRADED, STALE or DOWN) and how many tokens have a valid quote. If quotes go stale (older than 90 s) a banner appears and **new paper buys stop automatically**.

| Page | Status | What it does |
|---|---|---|
| **Desk** | ✅ works | Pipeline (watch → check → quorum → risk → paper fill → exits), the printed family wheel (click a segment, or use the Families list with Enter/Space, to filter), live agent votes, coins in play (click one for its numbers and a link to DexScreener), evidence matrix, open paper positions, market pulse across your tokens, live log, paper trades, paper equity chart and limit gauges. |
| **Proof** | ✅ works | Every quorum: which agents voted, each condition with the observed value and its data source, quote age, all 12 risk checks, the paper order and its result. Denied quorums are listed too. |
| **Agents** | ✅ works | Build your own agent from real metrics (it votes as the "Your agents" family and really changes what gets traded), start/stop/delete it, and see every agent's checks, votes, quorums and attributed paper P&L. |
| **Ledger** | ✅ works | Every paper buy, sell, cancellation, agent change and desk action, searchable, with CSV export. |
| **Paper account** | ✅ works | Virtual cash, equity, exposure, open positions (with mark age, marked *stale* when the quote is old), pending orders, closed positions, all settings in effect, and the **Pause** / **Reset** controls. |
| Backtest | ⛔ unavailable (N/A) | No historical data source, so no backtest is computed. |
| Narratives | ⛔ unavailable (N/A) | Not implemented in this version. |
| Dev hunt | ⛔ unavailable (N/A) | Developer-wallet data is not in the feed. |
| Lab | ⛔ unavailable (N/A) | Strategy search is not implemented in this version. |

---

## 3. How a paper trade happens

1. **Watch.** Every 30 s the server asks DexScreener for the latest numbers on your watchlist (8 well-known Solana tokens by default) plus up to 14 recently *promoted* tokens from DexScreener's boost/profile lists (these lists are **paid promotions**, not a quality signal; turn them off with `"discovery": { "enabled": false }`).
2. **Check.** Each agent tests its conditions on each fresh quote. If a number it needs is missing, it does **not** vote.
3. **Quorum.** At least `minVotes` agents from at least `minFamilies` different families must vote on the **same** observation. The built-in families each read a different dimension:
   - *Momentum* – price rising on 5 min and 1 h (or 6 h).
   - *Volume pace* – last 5 min volume running hotter than the hourly pace.
   - *Buy pressure* – buys clearly outnumber sells.
   - *Dip rebound* – down on the day / 6 h but turning up.
   - *Early pair* – young pool with real liquidity and positive short-term move.
   - *Your agents* – whatever you build.
4. **Risk desk.** 12 deterministic checks, all shown on the Proof page: desk not paused, daily loss limit not hit, quote present/positive, quote fresh (≤ 90 s), liquidity ≥ $50k, trade ≤ 2 % of pool liquidity, no open/pending position in that token, token cooldown (60 min), max open positions, max buys per rolling hour, exposure cap, enough virtual cash while keeping the reserve.
5. **Paper fill.** The order fills at the **next newer quote**, at the **worse** of the decision price and that next price, plus estimated slippage and fees. If the next quote is stale, missing or illiquid, the buy is **cancelled** (no fill is invented).
6. **Exits.** Take-profit ladder (default: sell 50 % at +8 %, the rest at +16 %), stop loss (−6 %), trailing stop (5 % below the peak once up 6 %), max hold (4 h). Exits only fill on a fresh, newer quote; while quotes are stale the position is shown at its last price, marked *stale*, and the sell waits.

**Costs are assumptions, not real venue fees:** 1 % fee per side + $0.50 per order, slippage at least 1.5 % (more for trades that are large compared with the pool). Change them in the settings. The displayed price is DexScreener's reference price — it is **not** a price you could necessarily trade at.

**Daily loss limit:** counts realized + estimated unrealized loss since the start of the day in **Asia/Manila** time (change `risk.dayTimeZone`). When hit, new buys pause until the next local midnight; exits keep running.

**Pause** (top bar or Paper account page) stops new paper buys; exits keep running so your limits still apply. **Reset** asks you to type `RESET`, then sets virtual cash back to the start and clears positions, ledger and quorum history (your own agents are kept).

---

## 4. Settings (`paper.config.json`)

Open `paper.config.json` in Notepad, change a value, save, then **restart** (close the black window, double-click `START.bat`). If a value is invalid the black window lists exactly what to fix and does not start.

| Setting | Default | Meaning |
|---|---|---|
| `contractAddress` | `""` (empty) | The PAYPER token mint address shown on the site. Empty = *NOT LAUNCHED YET*. Format-checked at start; see [docs/CONTRACT-ADDRESS.md](docs/CONTRACT-ADDRESS.md). On a host, the `TOKEN_MINT` environment variable wins over this. |
| `port` | 8787 | Browser address port (if busy, the next free one is used and shown). |
| `market.pollSeconds` | 30 | Seconds between quote updates (minimum 30: DexScreener caches for ~30 s anyway). |
| `market.maxQuoteAgeSeconds` | 90 | Older quotes count as stale: no new buys, exits wait. |
| `market.watchlist` | 8 tokens | List of `{ "symbol", "address" }` Solana token mint addresses (max 30). |
| `market.discovery.enabled` / `maxTokens` / `refreshMinutes` | true / 14 / 5 | Add recently promoted tokens from DexScreener lists. |
| `paper.startingCashUsd` | 10000 | Virtual starting cash (applies after a Reset). |
| `paper.tradeSizeUsd` | 100 | Virtual dollars spent per buy, fees included. |
| `paper.reserveUsd` | 500 | Virtual cash that is never spent. |
| `paper.feeBps` / `flatFeeUsd` | 100 / 0.5 | Assumed fee per side (100 bps = 1 %) and flat cost per order. |
| `paper.slippageBps` / `priceImpactModel` | 150 / true | Minimum assumed slippage; with the model on, at least 2 × trade ÷ liquidity. |
| `paper.maxPctOfLiquidity` | 2 | Refuse trades bigger than this % of the pool's liquidity. |
| `quorum.minVotes` / `minFamilies` | 3 / 3 | How much agreement is needed. |
| `risk.minLiquidityUsd` | 50000 | Minimum pool liquidity. |
| `risk.maxOpenPositions` / `maxExposureUsd` | 6 / 600 | Limits on open paper positions and their total cost. |
| `risk.maxBuysPerHour` | 4 | Rolling 60-minute cap. |
| `risk.dailyLossLimitUsd` / `dayTimeZone` | 150 / Asia/Manila | Daily loss pause and which clock defines "today". |
| `risk.cooldownMinutes` | 60 | Wait before buying the same token again. |
| `exits.takeProfit` | 50 % at +8 %, 50 % at +16 % | Ladder; percentages of the original quantity, max 100 % total. |
| `exits.stopLossPct` / `trailingPct` / `trailingArmPct` / `maxHoldMinutes` | 6 / 5 / 6 / 240 | Other exits. |
| `agents.customSlots` | 3 | How many of your agents may vote at once. |

The wording, page names and canvas ink colours are in `public/site.config.js`. The Greenbar styling itself is `public/css/greenbar.css`, and the printed family wheel is `public/js/ring.js`.

---

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| "Node.js was not found" | Install the LTS from https://nodejs.org/, then **close and reopen** the folder and double-click START.bat again. |
| Browser didn't open | Open **http://127.0.0.1:8787/** yourself (use the address printed in the black window). |
| Browser says it can't connect | Is the black window still open? Use `127.0.0.1`, not your computer's name. If your PC uses a company/VPN **proxy**, allow local addresses: Windows Settings → Network & Internet → Proxy → tick "Don't use the proxy server for local (intranet) addresses" and add `127.0.0.1;localhost` to the exceptions. |
| "Payper is already running" | It's open in another window — use that one. If you're sure it isn't running, delete `data\server.lock` and start again. |
| "Payper cannot start. Please fix: …" | A setting is wrong. The window (or the host's log) lists each problem in plain words. Fix it and start again. |
| "contractAddress in paper.config.json: …" or "TOKEN_MINT: …" | The token address is not a valid Solana address. See *Error messages* in [docs/CONTRACT-ADDRESS.md](docs/CONTRACT-ADDRESS.md), or set it back to `""` to show NOT LAUNCHED YET. |
| Feed shows **DOWN** or **DEGRADED** | The server can't reach `api.dexscreener.com` (no internet, firewall, proxy, or DexScreener is limiting requests). It retries automatically with growing pauses. No paper buys happen while quotes are stale. |
| "Settings problem in paper.config.json" | The window lists each wrong value. Fix it in Notepad and start again. If you broke the file, re-copy `paper.config.json` from the zip. |
| `preview.html` shows numbers but they never change | That is the design preview with **example data**. To see live data, start the working app with START.bat. |
| Everything looks empty | Normal at first. Check the Desk: "Coins in play" should list your tokens within ~30 s. Trades need agreement and passing risk checks. |
| State file damaged | On start, an unreadable `data\paper-state.json` is moved aside (renamed `.corrupt-…`, never deleted) and the backup `.bak` is used, or a fresh account is started. |
| Windows Firewall prompt | Shouldn't appear: the server only listens on 127.0.0.1 (this computer only). If it does, you can click Cancel. |

## 6. Public website (read-only) and the PAYPER contract address

- **Deploying:** [docs/DEPLOY.md](docs/DEPLOY.md) has the exact Render steps (paid web service + small persistent disk), the settings it needs (`PAYPER_MODE=public`, `PUBLIC_ORIGIN`, `DATA_DIR`, optional `TOKEN_MINT`), the cost to confirm before paying, and a Docker alternative.
- **Contract address:** [docs/CONTRACT-ADDRESS.md](docs/CONTRACT-ADDRESS.md): how *you* add, change or clear it, locally or on the host. There is deliberately no web page or API that can change it.
- **What public mode does:** binds 0.0.0.0 on `PORT`; accepts only the exact host in `PUBLIC_ORIGIN` (plus any exact names in `TRUSTED_HOSTS`); answers every POST/PUT/PATCH/DELETE with 403 *read-only*; hides Pause, Reset, Save and the agent Start/Stop/Delete buttons; shows a *SHARED DEMONSTRATION · not your wallet* notice; serves only the `public/` folder; adds HSTS; answers `/healthz` for the host's health check.
- **Environment variables** (all optional except where noted): `PAYPER_MODE` (`local` default, or `public`), `PUBLIC_ORIGIN` (required in public mode, e.g. `https://payper.onrender.com`; on Render the service's own onrender address is used if left empty), `TRUSTED_HOSTS` (comma-separated exact extra host names, no wildcards), `PORT`, `BIND_HOST` (public mode only), `DATA_DIR` (folder for the paper account; put it on a persistent disk), `TOKEN_MINT`, `MAX_STREAMS` (default 200 in public mode).

## 7. Tests

Double-click **`TEST.bat`** (or run `npm test`). The tests use only Node's built-in test runner and **synthetic test fixtures** (never shown in the app). `tests/public.test.mjs` checks public read-only mode (every change refused, exact host list, no file leaks) and the contract-address check; `tests/branding.test.mjs` checks the Payper name, the NOT LAUNCHED default and that no text promises earnings or real trading. `tests/frontend.test.mjs` adds static checks of the Greenbar front end:
- every element the scripts need still exists, and no control is hidden by CSS;
- every class has a style;
- the responsive breakpoints are in place;
- the colours pass contrast checks;
- the UNAVAILABLE labels are still there;
- there are no remote fonts;
- `preview.html` needs no server.

See `docs/TEST-REPORT.md` for what is covered and what was not tested (including the fact that the design was **not checked visually in a real browser**).

## 8. Limits, costs and data terms

- **Cost on your own computer: free.** No sign-up, no API key, no paid service. Market data: DexScreener public API (documented limits 300 requests/min for quotes, 60/min for lists; this app uses ~2–3 requests/min). DexScreener's API terms apply: https://docs.dexscreener.com/api/api-terms-and-conditions
- Not a complete list of all Solana launches; no developer, holder, wallet, slot or all-time-high data; quotes are snapshots up to ~30 s old (cache) plus the poll interval.
- Not a backtest and not a promise of profit. Paper results ignore many real-world effects (failed transactions, MEV, real price impact on thin pools).
- **Cost as a public website:** hosting is paid; see the estimate in [docs/DEPLOY.md](docs/DEPLOY.md) and confirm the price on the host's own page before paying.
- More background and sources: `docs/RESEARCH.md`.

## 9. For the curious (technical)

- One Node process, **no npm dependencies**: `server/server.mjs` (start), `app.mjs` (HTTP + API + Server-Sent Events, loopback only in local mode, read-only in public mode, Host-header and same-origin checks, 16 KB body limit, strict CSP), `market.mjs` (DexScreener client: batching, throttling, timeout, backoff, `Retry-After`), `rules.mjs` / `strategies.mjs` (metrics and agents), `risk.mjs`, `paper.mjs` (fill + exit math), `engine.mjs` (the desk), `store.mjs` (atomic JSON saves), `config.mjs` (settings validation), `deploy.mjs` (local/public mode, environment variables, contract-address format check).
- API (GET): `/api/status`, `/api/market`, `/api/agents`, `/api/quorums`, `/api/quorum/:id`, `/api/ledger`, `/api/state`, `/api/families`, `/api/fields`, `/api/capabilities`, `/api/project` (name, mode, PAYPER token state), `/healthz`, `/api/stream` (SSE: hello, check, prop, tick, quorum, trade, ledger, status). Writes (POST/DELETE, JSON, same origin): `/api/agents/custom`, `/api/agents/custom/:id/start|stop`, `DELETE /api/agents/custom/:id`, `/api/control/pause|resume|reset` (local mode only; public mode refuses them all with 403). Template endpoints this app does not provide (`/api/backtest`, `/api/chainbook`, `/api/narratives`, `/api/devhunt`, `/api/bots/all`) answer 404 `{"error":"unavailable","reason":…}`.
- Data lives in `data/paper-state.json` (+ `.bak`), or in `DATA_DIR` when that is set. The zip ships an **empty** `data` folder: there are no positions, ledger rows or logs from the build machine. Delete the `data` folder while the app is stopped to start completely fresh.
- Front end: `public/index.html` (markup), `public/css/greenbar.css` (the whole look, mobile-first; drawer and tab strip below 1100 px, pinned job-card sidebar above), `public/js/app.js` (client, unchanged behaviour plus glyphs, keyboard rows and the report run line), `public/js/ring.js` (printed family wheel, same API as the old ring), `public/js/brand.js` (contents list and tab strip).
- `preview.html` is generated from example data and has no script at all. It links `public/css/greenbar.css` and `public/fonts`, so keep it next to the `public` folder.
