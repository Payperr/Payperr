# Payper (PAYPER) · Greenbar edition — test report

**When:** 11 Nov 2026, about 15:40–16:00 Asia/Manila (PST, UTC+8).
**Where:** the build box (Linux, Node.js **v24.22.1**). No deploy was made, and no hosting provider was contacted.

## What changed in the Payper release

- **Name:** Swarm… → **Payper**, ticker **PAYPER**, everywhere. That covers the page title and config, the logo mark (now a "P"), the header stamp, the run line, the footer, the console banner, `START.bat`, `package.json`, `paper.config.json`, the README and the preview.
- **Token line:** shows **PAYPER token · NOT LAUNCHED YET** with no address and no links. The owner can set the address with `TOKEN_MINT` (host) or `contractAddress` (config). Once set, it shows the address, a Copy button and a pump.fun link. The server checks the format at start; the browser re-checks it before showing links.
- **Public read-only mode** (`PAYPER_MODE=public`, `server/deploy.mjs`):
  - exact `PUBLIC_ORIGIN` / `TRUSTED_HOSTS` (Render's own onrender URL and host are used automatically);
  - binds 0.0.0.0 on `PORT`;
  - `DATA_DIR`;
  - every write refused with 403;
  - `/healthz`, HSTS, the shared-demonstration labels;
  - the controls are hidden.
- **Deploy files:** `docs/DEPLOY.md`, `docs/CONTRACT-ADDRESS.md`, `render.yaml`, `Dockerfile`, `.dockerignore`.
- The trading engine (`engine`, `paper`, `risk`, `rules`, `strategies`, `market` apart from the User-Agent name, `store`) is unchanged.

## 1. Automated tests — `npm test` / `TEST.bat` → **51 passed, 0 failed**

- **39 earlier tests** (units, engine, server/API/SSE/security, static front end): unchanged, all pass. That includes the local-mode checks: 127.0.0.1 bind, foreign Host 421, cross-origin POST 403.
- **7 new public-mode tests** (`tests/public.test.mjs`):

| Check | Guards against |
|---|---|
| Contract address: empty means not launched. Real 32-byte base58 keys pass. These are rejected, and the error never echoes the input: `<script>`, a pump.fun URL, an attribute break-out, `javascript:`, 43×"1" (31 bytes), 44×"z" (too big), 0/O/l characters, two addresses, non-strings | injection, half-copied addresses, links pasted instead of addresses |
| Runtime: local stays 127.0.0.1 (BIND_HOST refused locally). Public needs an `https://` origin (no http, wildcard, path, credentials or query) and exact TRUSTED_HOSTS (no wildcards or schemes). The PORT/DATA_DIR defaults and the warning work. Render URL fallback and onrender host trust work. `TOKEN_MINT` beats config, and a blank one falls back. Error messages name their source | misconfiguration, wildcard hosts |
| All 13 write routes and methods (create/update/start/stop/delete agent, pause, resume, reset, wallet, PUT, PATCH, OPTIONS, unknown) → **403** `read-only`, with and without a correct Origin. An oversized body is also refused. **The engine state is byte-identical afterwards.** All GET endpoints still 200 | shared-control abuse, a reset of the shared demo |
| `/api/project`: name/ticker, `public-read-only`, `sharedDemo`, `paperOnly`, `realTrading:false`, `walletConnect:false`, the not-launched and address-set token shapes, the no-earnings note | inconsistent claims |
| Host list: the public host, an extra trusted host and `:443` are accepted. These get 421: `127.0.0.1`, `localhost`, look-alike suffix/subdomain, empty, and `X-Forwarded-Host` spoofing. `/healthz` works with any Host (GET/HEAD only). HSTS and CSP are present | DNS rebinding, host spoofing |
| Not served: config, package, server code, data/state/lock, tests, README, the deploy files, and traversal (4 encodings). No server path, tmp dir, home dir, state file name or `DATA_DIR` appears in any API answer | leaking files or paths |
| Local mode unchanged: writes work from the same origin; a public host name is refused; no HSTS | regressions |

- **5 new branding tests** (`tests/branding.test.mjs`):
  - the old name appears in no package file;
  - Payper/PAYPER is in the config, logo, stamp, run line, preview, START.bat (CRLF), console and package;
  - `contractAddress` is `""`; NOT LAUNCHED YET is the default; the link has no `href` until set; the address goes in as text only; no hard-coded pump.fun/DEX/explorer token links; no mint in `render.yaml`/`Dockerfile`;
  - no dividend / revenue-share / guaranteed-return / airdrop / "100x" / risk-free wording, and every sentence mentioning earnings, real trading or wallet sign-in is a negation;
  - the read-only UI hooks and shared-demo labels exist.
- **Mutation checks**, to confirm the tests bite (each reverted afterwards):

| Mutation | Result |
|---|---|
| Disable the read-only guard | public test fails |
| Change NOT LAUNCHED to LIVE | branding tests fail |
| Write "real trading is live" in the footer | branding test fails |
| Allow wildcards in origins/hosts | public test fails |

## 2. Live local runs (real DexScreener data) + jsdom DOM checks

Three servers were run from the package folder: local (8810), public (8811, `BIND_HOST=127.0.0.1`, `PUBLIC_ORIGIN=http://127.0.0.1:8811`), and public with `TOKEN_MINT` (8812). The mint was set to a well-known **existing non-PAYPER** mint, used only as a format fixture. The real `app.js` ran in jsdom against each. jsdom is a DOM emulator in Node, **not** a browser.

- **All three:**
  - title "Payper · paper-trading consensus desk", brand Payper / PAYPER, run line "Payper · paper desk";
  - footer says real trading is not implemented;
  - `FEED LIVE · 22/22`; all pages switch; 0 errors.
- **Local:** Pause, Pause new buys and Reset are visible; Save is enabled; no read-only notice; token NOT LAUNCHED YET with no `href`.
- **Public:**
  - `SHARED DEMONSTRATION · READ-ONLY` notice and the controls note are shown;
  - Pause ×2 and Reset are hidden; Save is disabled ("Saving is off on the public site");
  - the mode card reads "Shared demonstration … not your wallet";
  - the token is NOT LAUNCHED YET.
- **Public + mint:**
  - the token shows CONTRACT ADDRESS, the address as text and `href=https://pump.fun/coin/<mint>`;
  - Copy puts the exact address on the clipboard ("Contract address copied.");
  - with the clipboard denied, it falls back to selecting the text ("Press Ctrl+C…").
- **HTTP against the public server (curl):**
  - reset/pause/delete/create → 403;
  - `/paper.config.json`, `/server/app.mjs`, `/package.json`, `/data/paper-state.json`, `/README.md`, `/render.yaml` → 404;
  - extension-less paths such as `/.env` return the page shell, never a file;
  - `Host: evil.example` → 421; `/healthz` → `ok`.
- **Startup guards (real process):**
  - public without origin → "Payper cannot start … needs PUBLIC_ORIGIN";
  - pump.fun link as `TOKEN_MINT` → "Paste only the mint address, not a web link";
  - `BIND_HOST=0.0.0.0` locally → refused;
  - unwritable `DATA_DIR` → "cannot write to its data folder (EACCES)";
  - public default bind confirmed `0.0.0.0:<PORT>`;
  - missing `DATA_DIR` prints the ephemeral-storage warning.

## 3. Render configuration

`render.yaml` was written after reading Render's current Blueprint spec, disk, compute-plan, health-check, environment-variable and Node-version docs (11 Nov 2026). It **passes Render's published JSON schema** (`render.com/schema/render.yaml.json`); a deliberately wrong plan is rejected. It was **not** validated with the Render CLI (not installed) and not applied to any account. Prices in DEPLOY.md come from render.com/pricing the same day: $7/month Starter + $0.25/GB/month disk = about **$7.25/month**, plus tax and any bandwidth over 5 GB at $0.15/GB.

## 4. NOT tested — please read

- **No deploy; Render untested.** No account, repo, service, disk, domain or Blueprint was created or tried. Whether Render's proxy forwards the original Host header comes from how Render works and its health-check docs, not from a live test. If a real deploy shows 421, set `PUBLIC_ORIGIN` to the exact address in the browser bar.
- **Docker untested:** Docker is not installed on the box, so the `Dockerfile` was never built. Disk ownership for the non-root `node` user on a mounted volume is unverified; the app prints a clear error if it cannot write.
- **No visual verification.** No browser, headless browser or desktop was used, as instructed. The new token line, the read-only notice and the "P" logo were not seen rendered. Spacing may need a tweak.
- **No load or abuse testing** of the public site beyond the stream cap. There is no per-IP rate limiting in the app.
- **Windows and Node 26** were not tested; see the earlier notes below.
- **Format ≠ ownership:** the contract-address check proves the shape of a Solana address, not that it is the official PAYPER token.

---

## Appendix: earlier Greenbar release checks (still valid; the front end has been extended since)

### A1. Automated tests — `npm test` / `TEST.bat` → **39 passed, 0 failed**

- **The 29 original tests** (units, engine, server/API/SSE/security) were rerun unchanged and all pass. They also passed after extracting the final zip to a path with a space (`a folder with a space`).
- **The 10 new static front-end checks** (`tests/frontend.test.mjs`, no browser, no dependencies):

| Check | What it guards against |
|---|---|
| Every `$('id')` in `app.js` / `brand.js` exists in `index.html` (or is generated from a template) | a moved or renamed element silently breaking a binding |
| Element ids are unique | duplicate ids after editing the markup |
| Every class used in markup and script templates has a rule in `greenbar.css` | an unstyled or forgotten component |
| No rule hides controls, provenance badges, PAPER labels, the nav, banner or Pause/Reset (outside print and the desktop-only drawer chrome); toast/trade slip have a visible state; the old "Pause hidden on phones" rule is gone | CSS hiding a control |
| Responsive audit: 640 / 900 / 1100 / 1440 px breakpoints, drawer below 1100 px and pinned sidebar above, tab strip only below 1100 px, no fixed width over 360 px outside media queries, wide tables scroll inside their panel, no horizontal page scroll | phone overflow / lost navigation |
| Accessibility: visible focus ring, `prefers-reduced-motion` stops all CSS animation and the wheel's stamps, family glyphs instead of coloured dots, × / ? cells in the evidence matrix, hatched failed bars, filled/empty feed squares + state word, keyboard-operable rows (Enter/Space) with focus kept across re-renders | colour-only status, keyboard traps |
| Contrast of ink, ink2, muted, dim, red, ochre and green on paper, mint band and manila ≥ 4.5:1 (WCAG AA); white on ink ≥ 7:1 | low-contrast text |
| Backtest / Narratives / Dev hunt / Lab are `na:true` with "Unavailable" descriptions; Holder agents + On-chain wallets keep their UNAVAILABLE badges; the nav says N/A; the run line says "unavailable"; badge words LIVE FEED / PAPER · virtual / UNAVAILABLE unchanged | dishonest or missing unavailable labels |
| Courier Prime 400/700 roman + italic declared with the correct weights/styles and present locally, OFL licence shipped, no remote URL in CSS/HTML/JS, canvas text uses the shipped font | remote dependencies, faux bold/italic |
| `preview.html`: no `<script>`, no fetch/EventSource/import, only relative paths that exist in the package, labelled DESIGN PREVIEW / EXAMPLE DATA ONLY, never a bare "LIVE FEED" badge, no password/seed/wallet inputs | a preview that needs a server or could be mistaken for live data |

Two deliberate mutations confirmed that the checks bite:
- re-adding `.top-r .btn.sm{display:none}` in a phone media query fails the "never hides" check;
- renaming `id="ctl-pause2"` fails the binding check.

Original test coverage (unchanged):

| Area | Test (file) |
|---|---|
| Conditions incl. missing data (missing never passes; empty agent never votes) | `units` · conditions |
| Market cap ≠ FDV (never substituted; inconsistent cap ignored), non-positive / non-numeric price, derived metrics, future pair time | `units` · normalize |
| Best pair per token: base-token match, Solana only, highest liquidity | `units` · pickBestPairs |
| DexScreener client: observed time = Date − Age, 429 backoff honouring Retry-After (no request during backoff), timeout, batches of ≤ 30 | `units` · market client |
| Buy and sell fees + slippage, liquidity impact term, invalid inputs → no fill | `units` · paper fills |
| Stop loss, partial take-profit ladder, trailing stop (armed/not armed), max hold | `units` · exits |
| Config validation: non-finite / wrong type / bad address / bad time zone / unknown key / ladder > 100 % | `units` · config validation |
| Shipped `paper.config.json` valid and conservative (poll ≥ 30 s, staleness ≤ 90 s, non-zero costs, Asia/Manila day) | `units` · shipped config |
| Builder: unsupported fields rejected with reasons; bad operator / value / name rejected | `units` · custom agent validation |
| Strategy set small, ≥ 5 distinct families, every rule reads a supported metric | `units` · strategy set |
| Day boundary in Asia/Manila (00:00 local = 16:00 UTC) | `units` · day key |
| Empty first run: no quorum, no trade, cash untouched | `engine` |
| Quorum requires distinct families (4 votes from 3 families ≠ 4 families) and records evidence per condition | `engine` |
| Delayed fill at the worse of decision vs next price, + slippage + fees; ledger/trade marked paper + simulated, no signature | `engine` |
| Invalid quote (zero price, NaN price, missing liquidity) → no entry | `engine` |
| Stale quote: pending buy cancelled; open position not sold without a valid fresh price; valuation marked stale; exit fills when feed returns | `engine` |
| Dedupe: identical observation judged once; repeated identical denials not re-recorded; single buy | `engine` |
| Insufficient virtual cash (reserve respected) | `engine` |
| Hourly buy cap on a rolling 60 min window, released after the hour | `engine` |
| Exposure cap | `engine` |
| Daily loss pause on realized + unrealized, lifted at the next Asia/Manila day (rollover) | `engine` |
| Partial exits: 50 % then remainder; cash change = realized P&L | `engine` |
| Custom agents change execution (quorum only forms with it); stopped agent doesn't vote; slot limit | `engine` |
| Pause / resume / reset (reset refused without `RESET`) | `engine` |
| Persistence: restart restores cash, positions, ledger; no temp file left; corrupt file moved aside and fresh start; path with spaces | `engine` |
| HTTP: every endpoint + JSON schema keys, SSE named events (hello, check, prop, tick, quorum, trade, status), template endpoints that don't exist answer 404 "unavailable" with a reason, no explorer links / signatures in any API output, write endpoints | `server` |
| Security: foreign Host → 421, cross-origin POST → 403, non-JSON → 415, > 16 KB → 413, bad JSON / non-object → 400, path traversal (4 encodings) doesn't leak files, SPA fallback, 404 for missing assets, CSP header, bound to 127.0.0.1 | `server` |
| Windows path handling: root via `fileURLToPath(import.meta.url)`, never `URL.pathname` | `server` |
| Frontend contains no simulator, no demo fallback, no explorer-transaction link code | `server` |

### A2. Non-browser DOM interaction checks (jsdom; dev-only, not shipped)

The real `public/js/app.js` was loaded into **jsdom**. jsdom is a DOM emulator in Node: no browser engine, no Playwright/Chromium. It had a real Server-Sent-Events connection to a running server. Every page was visited and the main controls were used. Canvas drawing is stubbed, and jsdom does not evaluate media queries, so the "hidden control" probe below checks the mobile-first base styles only.

**Against the packaged app, live DexScreener data** (port 8796): 0 errors, 0 warnings.
- Feed and pages: `FEED LIVE · 22/22`; all 9 pages switch.
- Builder: save → stop → delete round trip works.
- Proof: a real quorum showing 4 evidence/risk cards and 12 risk rows.
- Paper account: positions and tiles render; Pause ↔ Resume relabels.
- Drawer: opens, and closes with Esc.
- Badges: LIVE FEED ×10, PAPER · virtual ×8, UNAVAILABLE ×6, each UNAVAILABLE panel showing the server's reason text.
- Links: the only outbound ones are dexscreener.com pair links and docs.dexscreener.com; no explorer links; no unfilled placeholders.

**Greenbar-specific probes (same run):**
- Run line reads "Report 09 · Paper account / Page 009 / Run 2026-11-11", and on Lab "Report 07 · Lab · unavailable".
- The contents list marks backtest, narr, devhunt and lab as **N/A**, with screen-reader text "(unavailable in this version)".
- The mobile tab strip shows Desk, Proof, Agents, Ledger + More (no unavailable page takes a tab).
- 0 coloured `.dot` elements remain; family glyphs show in lists, the log, Proof cards and the Every-agent table.
- Families list: **Enter** toggles a family (`aria-pressed=true`, filter caption shown, "clear filter" visible) and **Space** toggles it back. Keyboard focus **stays on the same row after the 3-second re-render**.
- Coins in play: **Enter** opens the coin chart panel. Proof list: **Enter** opens a quorum.
- Reset opens the confirmation dialog.
- None of these is `display:none` under the base styles: Pause (top bar and account page), Reset, the feed box, the menu button, the PAPER stamp, the run line, the paper flag, the tab strip, More.

**Against fixture servers** (test fixtures, dev-only, never in the app):
- The same flows passed with populated panels: 2 quorums, a paper fill, log, trades.
- **STALE feed:** "FEED STALE · 0/2", the stale NOTICE banner text, and the pipeline showing STALE/WAIT.
- **DOWN feed:** "FEED DOWN · 0/0" and the ALERT banner "Market feed is not answering (HTTP 503)…".
- The probe script itself errored once on the DOWN server because there were no coin rows to focus. That was a harness limitation, not an app error.

`preview.html` was parsed in jsdom: 9 pages, no duplicate ids, every in-page link has a target, 0 scripts, 0 forms. The only inputs are 4 read-only/disabled example fields.

### A3. Live runtime checks (real network, real DexScreener data)

Packaged zip extracted to a folder with a space and started with `node server/server.mjs --port 8796`:
- index, CSS, JS, the four fonts and the logo are served with correct types;
- `/api/status` reports feed `live` with 22/22 quotes;
- `/api/capabilities` lists the unavailable sections with reasons;
- SSE `hello` arrives on connect;
- `/api/backtest` returns 404 "unavailable";
- the server listens on 127.0.0.1 only.

Security, all unchanged:
- Host `attacker.example` → 421;
- cross-origin POST → 403;
- `/../paper.config.json` → 404;
- the CSP header is unchanged (`script-src 'self'`, `font-src 'self'`, …).

Within about 30 s the real engine placed one paper buy from live data; its unrealized P&L showed the estimated round-trip cost (about −$5.9), as designed. No trade was manufactured. SIGTERM saved state and removed the lock file. The instance was then restarted with an **empty data folder** for the hand-off.

### A4. Package hygiene

- the Greenbar zip: 41 files, no npm dependencies, `node_modules` or dev tools.
- `data/` contains only `.keep`: no positions, ledger, logs or lock from the build box.
- `START.bat` and `TEST.bat` use CRLF line endings. `server.mjs` keeps the `fileURLToPath` root and the SIGHUP handler.
- The old theme files (style.css, paper.css, Geist/JetBrains fonts, aurora preset) were removed because nothing references them any more.

### A5. NOT tested — please read

- **No visual verification.** Per instructions no browser, headless browser, Playwright/Chromium or desktop was used. The box's supported browser cannot open local files or localhost here, and that was not routed around. Neither the working app nor `preview.html` has been seen rendered: not the tractor margins, the mint banding, the printed wheel, the stamps, or the phone and tablet layouts. Layout claims come from reading the CSS and from the static checks above, **not from screenshots**. Expect some spacing or overlap to need a tweak after the first real look, especially:
  - the wheel's legend labels on mid-width screens;
  - the header stamp beside long page titles;
  - the 1100–1440 px desk grid.
- **Windows was not available.** `START.bat`, `TEST.bat`, the `--open` browser launch and closing the console window were not run on Windows. Closing the window sends a console-close event that the server handles as SIGHUP and uses to save. Windows may terminate the process a few seconds later, and that path is only verified on Linux. State is also saved after every poll and every user action, so at worst the last few seconds are lost. Ctrl + C remains the recommended way to stop.
- **Node 26 was not tested** (the box has Node 24.22.1). The code uses only stable APIs available since Node 18.
- **Fonts on file://.** `preview.html` loads Courier Prime from `public/fonts` by relative path. Most browsers allow that from disk, but if one blocks local font loading the page falls back to Courier New. The look is close, but bold and italic will be the system font's.
- **Long-running behaviour** (hours or days, Asia/Manila midnight rollover live, rate-limit storms) is covered by unit tests only.
- **No claim of profitability.** Paper results are what they are; fills are simulated estimates.
