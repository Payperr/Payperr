> **Package note.** This file is the source research used to build the paper-trading engine that Payper runs on (written under the project's earlier working name, which has been replaced with Payper below; otherwise copied verbatim from the research worker (`RESEARCH.md`, 11 Nov 2026)). The addendum at the end records what the shipped build actually adopted, what it deliberately left out, and the extra checks made while coding. Where the research mentions SOL-denominated limits (e.g. `bagSize` 0.05 SOL), the shipped app uses **virtual USD** instead (see `paper.config.json`).

---

# Payper paper-trading backend — source research

**Status:** read-only research for a future Node (Windows) build. No backend code was written, no accounts or API keys were created, and no trades were placed.

**Researched:** 11 Nov 2026, 12:32–12:34 PM Asia/Manila (04:32–04:34 UTC). Live public GETs were made only to officially documented, no-key endpoints.

**Constraint for v1:** no sign-up and no API keys. That rules out the official pump.fun developer API, CoinGecko/GeckoTerminal Demo or Pro keys, and Jupiter’s keyed plans.

---

## 1. Recommendation (short)

Build a **local Node.js backend** that starts from a **configurable watchlist of Solana mint addresses**, then optionally adds a **throttled discovery slice** from documented “new/trending” lists. Poll **DexScreener** as the primary pair/price/volume/liquidity feed. Use **Jupiter Price API v3** only for SOL-in-USD (and other established mints). Use **GeckoTerminal** sparingly for discovery and for pool-detail fields DexScreener does not provide (especially `launchpad_details`).

Do **not** claim to cover every pump.fun launch, to verify on-chain “dev” or “caller” facts, or to fill at the last traded price. The template’s ~19 families and 5–12 “on-chain-verified” claims cannot all be reproduced honestly with these feeds.

Paper-trade only, against a virtual reserve, with conservative fees, slippage, a stale-feed halt, and the existing desk limits (`bagSize` 0.05 SOL, 10 buys/hour, 0.3 SOL exposure, 1 SOL daily loss).

---

## 2. Connectors

`SearchPlugins` was run for Solana / DexScreener / GeckoTerminal / Jupiter / pump.fun market data. **No matching connector is installed or listed** for those services. Official public docs and documented HTTP GETs were used instead. (Unrelated trading plugins such as Kraken or Alpaca were ignored.)

Connect Apps fallback, if a connector is wanted later: https://cursor.com/grok-bot/link/v1/marketplace?tab=plugins

---

## 3. Official no-key sources

### 3.1 DexScreener REST — primary feed

| | |
|---|---|
| Base | `https://api.dexscreener.com` |
| Auth | None documented on the public reference. No key was sent; all test calls returned 200. |
| Docs | https://docs.dexscreener.com/api/reference |
| Terms | https://docs.dexscreener.com/api/api-terms-and-conditions (updated 18 Aug 2023). Commercial use is allowed, but you may not use the API to build a product whose **primary purpose is to compete with DexScreener**. Data is licensed, not owned. Terms also mention a “free and paid version” at checkout; the **public reference still lists no auth and only per-endpoint rate limits**. Treat a paid plan as unverified for this pass. |
| Rate limits (docs) | Pair / token / search group: **300 req/min**. Profiles, boosts, ads, community takeovers, orders, metas: **60 req/min**. |
| Rate-limit headers | **None observed** on 200 responses. Back off on HTTP 429 (not triggered in these tests). Limits are commonly per client IP. |
| Cache / freshness (observed, not an SLA) | Search: `Cache-Control: public, max-age=60`, `age: 49`, `cf-cache-status: HIT`. Token and token-pairs and metas: `max-age=30`. **No last-trade or last-update field on pair objects.** Treat a snapshot as stale up to the cache window plus any Cloudflare `age`. Official docs do not publish a lag SLA. |
| WebSocket | https://docs.dexscreener.com/api/websockets — streams **profiles, boosts, ads, community takeovers only**, not pair prices or trades. Not useful as a price bus. |
| Historical / OHLC / slot tape | **Not in the public REST reference.** |

**Endpoints to use**

| Method | Path | Use | Limit group |
|---|---|---|---|
| GET | `/tokens/v1/solana/{tokenAddresses}` | Watchlist poll. Up to **30** comma-separated mints. Observed: **JSON array** of pairs (not `{pairs:[]}`), apparently **one primary pair per mint**. | 300/min |
| GET | `/token-pairs/v1/solana/{tokenAddress}` | All pools for one mint. Use when the primary pair is missing, has a bad quote, or has null price/liquidity. | 300/min |
| GET | `/latest/dex/pairs/solana/{pairId}` | One pair by pool address. | 300/min |
| GET | `/latest/dex/search?q=` | Symbol / name / address lookup. Returns `{schemaVersion, pairs}` and **can mix chains** (a `SOL/USDC` search returned Solana, Base, and Robinhood). Max observed page: 30 pairs. | 300/min |
| GET | `/metas/trending/v1` | Narrative list for the Narratives page. | 60/min |
| GET | `/metas/meta/v1/{slug}` | One meta plus its pairs (documented; not live-tested). | 60/min |

Profiles / boosts / ads / takeovers are documented and no-key, but they are **paid promotional lists**, not a launch firehose. Do not treat them as organic discovery.

**Pair fields (schema + observed)**

- Identity: `chainId`, `dexId`, `url`, `pairAddress`, optional `labels` (observed: `CLMM`, `DLMM`, `CPMM`, `DYN2`, `v3`, `wp`).
- `baseToken` / `quoteToken`: `{address, name, symbol}`.
- Prices: `priceNative`, `priceUsd` (strings; **can be absent**, see pumpfun row below).
- Windows on `txns`, `volume`, `priceChange`: **`m5`, `h1`, `h6`, `h24` only** (no m15/m30, no slot window). `txns.*.buys` / `sells` only (no unique buyers).
- `liquidity`: `{usd, base, quote}` — nullable / missing on some rows.
- `fdv`, `marketCap`: numbers, **nullable / omitted**.
- `pairCreatedAt`: **Unix time in milliseconds** (confirmed: `1688106058000` → 2023-06-30, `1779397336000` → 2026-05-21).
- Optional `info` (`imageUrl`, `websites`, `socials`, …), optional `boosts.active`.
- **No ATH, no last-trade timestamp, no holder, mint-authority, LP-lock, or dev-wallet fields.**

Observed `dexId` values on Solana: `raydium`, `orca`, `meteora`, `pumpswap`, `pumpfun`, plus others in search (`metadao`, `pancakeswap`). `pumpfun` ≠ `pumpswap`. A `dexId: "pumpfun"` row in `/token-pairs` had **no `priceUsd`, no `liquidity`, no `fdv`/`marketCap`, volume 0**. Skip such rows for marks and fills.

`/tokens/v1` for wrapped SOL (`So11111111111111111111111111111111111111112`) omitted `fdv` and `marketCap` entirely. For JUP, both were present and **not equal** (see §7).

### 3.2 GeckoTerminal public API (`api.geckoterminal.com`) — discovery + pool detail

| | |
|---|---|
| Base (keyless) | `https://api.geckoterminal.com/api/v2` — **not** the keyed `/onchain` path on `api.coingecko.com` / `pro-api.coingecko.com`. |
| Auth | No key. Official warning: do **not** send `x-cg-demo-api-key` or `x-cg-pro-api-key`. Optional `Accept: application/json;version=20230203`. |
| Docs | Keyless overview: https://docs.coingecko.com/docs/keyless-public-api |
|  | Public API notes (beta, ~10 calls/min, 1-minute cache, 2–3s update after confirm — these two figures **conflict** with the keyless page): https://api.geckoterminal.com/docs/index.html |
|  | Pool by address: https://docs.coingecko.com/reference/pool-address |
|  | New pools by network: https://docs.coingecko.com/reference/latest-pools-network |
|  | OHLCV: https://docs.coingecko.com/reference/pool-ohlcv-contract-address |
|  | Trades overview: https://docs.coingecko.com/reference/onchain-trades-overview |
| Rate limits | **Cite conservatively: ~5 calls/min, dynamic, IP-shared**, from the current keyless docs. The GeckoTerminal docs page says ~10/min; an older support article says 30/min. Official keyless text: **not suitable for production polling or high-frequency updates**. No rate-limit headers were observed. Back off exponentially on 429. |
| Cache | Official public page: cached **1 minute**; data “as fast as 2–3 seconds after a transaction is confirmed.” Observed `Cache-Control: max-age=30, public, must-revalidate, s-maxage=60`. |
| Attribution | Required if you display this data: see the Attribution Guide linked from the keyless page and https://docs.coingecko.com/docs/useful-links |
| Terms | CoinGecko API Terms, linked from the keyless page. Keyless is described as testing / prototyping. |

**Endpoints (keyless path prefix `/api/v2`)**

| Path | Notes |
|---|---|
| `/networks/solana/new_pools?include=base_token,dex` | Official: pools created in the **past 48 hours**, **20 per page**, `page` param; pagination **beyond 10 pages needs Analyst+**. Live page 1 was 20 pools, all **~0.9–1.6 minutes** old. This is a **newest slice**, not every new Solana or pump.fun launch. |
| `/networks/solana/trending_pools` | Documented example on the keyless page. Use rarely. |
| `/networks/solana/pools/{address}?include=base_token,dex` | Full pool detail. **This is where `launchpad_details` appeared.** |
| `/networks/solana/tokens/{address}` | Token-level data (not live-tested). |
| `/simple/networks/solana/token_price/{addresses}` | Batch prices (not live-tested). |
| `/networks/solana/pools/{pool}/ohlcv/{minute\|hour\|day}` | `[timestamp, open, high, low, close, volume]`; unix seconds; max 1000 bars; Basic/keyless historical window is **past 6 months** per the OHLCV doc. Useful later for “recent high,” not true ATH. |
| `/networks/solana/pools/{pool}/trades` | Recent trades (keyless). Time-range, token-wide trades, liquidity events, top traders are **Analyst+** and out of scope. |

**List vs detail (important):** `new_pools` items observed **did not include** `launchpad_details`, `pool_name`, `pool_fee_percentage`, or `locked_liquidity_percentage`. For the same LBUCKS/SOL pool, `fdv_usd` was **null on the list** and **present on the detail** (`3484.979945`). `market_cap_usd` was null on both. Call the **pool-address endpoint** only for candidates you might trade; do not poll it for every new pool.

Observed `launchpad_details` on that pump-fun pool (11 Nov 2026, 12:33 PM Asia/Manila):

```json
{
  "graduation_percentage": 25.84,
  "completed": false,
  "completed_at": null,
  "migrated_destination_pool_address": null
}
```

Official meaning: bonding-curve / non-graduated launchpad pools expose graduation status and migration. `locked_liquidity_percentage` is documented as updated **daily** (too slow for short-lived memes). Unverified market cap is officially **null**; the UI may show FDV instead and “might not be accurate.”

GT windows (richer than DexScreener): `m5`, `m15`, `m30`, `h1`, `h6`, `h24`. Transactions include `buys`, `sells`, `buyers`, `sellers`. Amounts are often **strings**. Dex id for Pump.fun is `pump-fun` (hyphen), not DexScreener’s `pumpfun` / `pumpswap`.

Observed dex mix on one `new_pools` page: `pump-fun` 12, `pumpswap` 3, `meteora-dbc` 3, `meteora-damm-v2` 2. Several had `reserve_in_usd` of `$0.00`–`$0.04` — **filter a minimum reserve**.

### 3.3 Jupiter Price API v3 — SOL USD reference

| | |
|---|---|
| Endpoint | `GET https://api.jup.ag/price/v3?ids={mints}` (up to 50 mints) |
| Auth | Keyless allowed. Optional `x-api-key` raises limits (not used). |
| Docs | https://developers.jup.ag/docs/price |
| Limits | https://developers.jup.ag/docs/portal/rate-limits — keyless **0.5 rps / 30 rpm**, 60s sliding window. Headers: `x-ratelimit-remaining`, `x-ratelimit-current`, `x-ratelimit-reset` (unix seconds). |
| What it is | **Reference** USD price from the last on-chain swap plus reliability heuristics. **Not an executable quote.** No history except `priceChange24h`. |

Observed 200 body (04:32:11 UTC):

```json
{
  "So11111111111111111111111111111111111111112": {
    "createdAt": "2024-06-05T08:55:25.527Z",
    "liquidity": 831165972.1200459,
    "usdPrice": 82.98312229326021,
    "blockId": 467990183,
    "decimals": 9,
    "priceChange24h": -3.5495805629154145
  }
}
```

Notes: `createdAt` is token creation (fixed for SOL), **not** price time. Recency is `blockId`; without a slot source you cannot convert that to lag in seconds. `priceChange24h` is a **percent** (`-3.55` means −3.55%). **Missing mints are omitted**, not `null` — typical if no trade in 7 days or heuristics fail. Many new pump.fun tokens will be missing here. Use Jupiter for **SOL (and large caps)**, not as the meme mark.

Observed headers after one keyless call: `cache-control: public, max-age=5`, `x-ratelimit-current: 1`, `x-ratelimit-remaining: 4`, `x-ratelimit-reset: 1794371541` (04:32:21 UTC). Remaining=4 after one call is **tighter than a naive 30/min reading**. Honour the headers; do not assume the full 30 rpm is always available.

Same-moment SOL USD scatter: Jupiter **82.983**, DexScreener SOL/USDC **82.99**, GeckoTerminal quote **~83.08**. Pick one primary mark per asset and do not treat the last price as a fill.

### 3.4 Official but **not** no-key (do not use in v1)

**pump.fun developer API** — https://docs.pump.fun/  
Base `https://api.pump.fun/v1`, `Authorization: Bearer pf_live_…`. Apply at developers.pump.fun; keys need approval. Default limits: 2 rps, 120-request bucket, 50,000/UTC day. Documented surface is largely **profiles, social graph, callouts, leaderboards, public positions** — not verified here as a full launch/market-data firehose. Out of scope until the user is willing to apply for a key.

Keyed CoinGecko Demo/Pro and Jupiter Free+ would raise rate limits later; they require sign-up.

Public Solana RPC is official but is not a market-data API and is a poor no-key primary feed. Optional later for mint supply / slot, not v1.

---

## 4. Live test log

All times below are converted to Asia/Manila as well as UTC. No 429s.

| Time (UTC) | Request | Status | Latency | Notes |
|---|---|---|---|---|
| 04:32:10 (12:32:10 PM Asia/Manila) | DexScreener `GET /latest/dex/search?q=SOL/USDC` | 200 | 69 ms | 30 pairs; chains solana 25, base 4, robinhood 1. Cache 60s, `age: 49`. |
| 04:32:10 | DexScreener `GET /tokens/v1/solana/So111…,JUP…` | 200 | 84 ms | JSON **array of 2** pairs. Cache 30s. |
| 04:32:11 | Jupiter `GET /price/v3?ids=So111…` | 200 | 1.22 s | Body in §3.3. |
| 04:32:44 | DexScreener `GET /token-pairs/v1/solana/8wxkv…pump` | 200 | 127 ms | **18 pools**; dex mix meteora 11, pumpswap 3, raydium 3, pumpfun 1. Cache 30s. |
| 04:32:44 | DexScreener `GET /metas/trending/v1` | 200 | 59 ms | Array of 18 metas. Cache 30s, `age: 9`. |
| 04:32:45 | GT `GET /api/v2/networks/solana/new_pools?include=base_token,dex` | 200 | 95 ms | 20 pools, 21 included. Cache max-age 30 / s-maxage 60. |
| 04:33:57 (12:33:57 PM Asia/Manila) | GT `GET /api/v2/networks/solana/pools/8qY2opBi…?include=base_token,dex` | 200 | 281 ms | Same LBUCKS pool as list[0]; `launchpad_details` present; `fdv_usd` now set; `market_cap_usd` still null. |

Compact DexScreener primary-pair example (`/tokens/v1`, JUP/SOL on Orca): `priceUsd` `"0.2616"`, `liquidity.usd` 574021.75, `fdv` 1831568077, `marketCap` 868524196 (unequal), `pairCreatedAt` 1706675725000, windows `m5/h1/h6/h24`.

GT `new_pools` first item: id `solana_8qY2opBiJDipcLEgEkJPQRWnQmRuUjJRxeafGtscfdnD`, name `LBUCKS / SOL`, dex `pump-fun`, `pool_created_at` `2026-11-11T04:32:08Z`, `reserve_in_usd` `"2679.6124"`, `fdv_usd`/`market_cap_usd` null, txs `{buys:22,sells:9,buyers:22,sellers:9}` copied across all windows (new pool). About 90 seconds later, detail had `fdv_usd` 3484.98, reserve 2660.49, `graduation_percentage` 25.84, and h24 txs `{buys:56,sells:31,buyers:53,sellers:30}`.

---

## 5. Suggested field mappings (feeds → desk)

Normalize to one internal snapshot per mint, with `source`, `observedAt` (HTTP `Date` minus `Age` if present), and `staleAfter`.

| Internal field | Preferred source | Fallback / notes |
|---|---|---|
| `mint`, `symbol`, `name` | DexScreener `baseToken` (if quote is SOL/USDC) | GT `included[]` token attributes |
| `pairAddress`, `dexId`, `labels` | DexScreener primary pair | Prefer quote SOL or USDC; if `/tokens/v1` is weak, pick **max `liquidity.usd`** from `/token-pairs` among those quotes; skip null price/liquidity |
| `priceUsd`, `priceNative` | DexScreener `priceUsd` / `priceNative` | GT `base_token_price_usd` / `base_token_price_native_currency` (parse strings). Do not mix sources mid-trade. |
| `solUsd` | Jupiter `usdPrice` for wrapped SOL | DexScreener SOL/USDC `priceUsd` |
| `liquidityUsd` | DexScreener `liquidity.usd` | GT `reserve_in_usd` |
| `volume.*`, `txns.*`, `priceChange.*` | DexScreener m5/h1/h6/h24 | GT also has m15/m30 and unique buyers/sellers |
| `fdvUsd`, `marketCapUsd` | DexScreener when present | GT strings; often **null on new pumps**. Never invent one from the other without labelling it. |
| `pairCreatedAt` | DexScreener ms → ISO | GT `pool_created_at` (`…Z`) |
| `curve.graduationPct`, `curve.completed`, `curve.migratedPair` | **GT pool detail only** `launchpad_details` | Not on DexScreener; not on GT `new_pools` list |
| `meta` | DexScreener `/metas/trending` + `/metas/meta/{slug}` | Name/symbol word overlap is a weak extra signal |
| Template `sym` / `mint` / `mc` / `fams` / `state` | Derived | `mc` may be null — show “n/a”, do not fake a cap |
| SSE `prop` / `check` / `quorum` / `trade` | Engine, not the vendor | `sig` for paper trades must be labelled simulated (template already has `common.simTx`) |

Adapter endpoints already expected by `/workspace/quorum-futuristic-template/js/adapter.js`:  
`GET /api/agents`, `/api/bots/all`, `/api/quorums?n=200`, `/api/quorum/:id`, `/api/backtest`, `/api/ledger`, `/api/chainbook`, `/api/state` (wallets), `/api/narratives`, `/api/devhunt`, `POST /api/me/agent`, `POST /api/me/wallet`, SSE `data.streamPath` (default `/api/stream`) with events `prop`, `check`, `tick`, `quorum`, `trade`. Keep `data.fallback: 'none'` so missing sections stay unavailable rather than simulated.

---

## 6. Market cap vs FDV — do not treat them as the same

Official and observed differences:

- DexScreener exposes both, both nullable. In the `SOL/USDC` search, 27/30 pairs had `marketCap == fdv`; **3 differed**. JUP: FDV **1.831B**, market cap **0.869B**. Wrapped SOL had **neither**.
- GeckoTerminal official: **unverified market cap returns `null`**; the website may display FDV instead and it “might not be accurate.” Verified market cap comes from CoinGecko and can even exceed FDV if other networks are included. On the live `new_pools` page, **all 20 `market_cap_usd` were null**; only 7 had `fdv_usd`. The LBUCKS detail had FDV and still **null market cap**.
- For brand-new pump.fun coins, **market cap is usually unavailable**. A “mc ≤ $30k” rule must **fail closed** (do not propose) when `marketCap` is null, or be explicitly rewritten as an **FDV** rule with a visible label.
- Never fill a null market cap with FDV silently. If you show FDV, name it FDV.

---

## 7. Claim checks: what cannot be claimed

The template copy says claims are “verified against on-chain data.” With no-key aggregator feeds, most of the simulated claims **must not be emitted as verified**.

| Simulated / original-style claim | With v1 feeds |
|---|---|
| Liquidity ≥ 4× bag | **Yes**, when `liquidity.usd` or `reserve_in_usd` and `solUsd` are present. Bag USD = `bagSize * solUsd`. Fail closed if either side is missing. |
| Market cap ($) | **Partial.** Use only a real `marketCap`. If null, mark the check unavailable. Do not silently use FDV. |
| Curve / pool (venue) | **Partial.** DexScreener `dexId`/`labels`; GT relationship `dex.id` (`pump-fun`, `pumpswap`, `raydium`, …). |
| Curve filled (%) | **Partial, GT pool detail only** (`launchpad_details.graduation_percentage`). Not on DexScreener; not on the new-pools list. Call at most when a coin is a serious candidate. |
| Below ATH (%) | **Cannot claim true ATH** (no ATH field). Optional later: “below **recent OHLCV high**” from GT, clearly labelled, rate-limit heavy. |
| Volume, last 25 slots | **Cannot.** Only minute/hour windows. Use m5/h1 volume instead, labelled as such. |
| No one-slot crash | **Cannot** (no slot-level tape). |
| Dev is not a rugger / dev sold / dev buy (SOL) / dev lock / dev burned the bag | **Cannot.** |
| No drip buyer / wallet is a known caller / copy smart wallets / copy callers | **Cannot.** |
| Not the project coin | **Cannot** unless the user maintains an explicit exclude list. |
| X talk / social heat | **Cannot** as a verified check. Token `info.socials` only proves a link exists. |

Fail closed: a family must not vote when a required metric is missing. The Proof page should show **Unavailable**, not a green pass.

Dev hunt, “first slot,” and Lab breeding against historical on-chain facts are **out of scope** for v1. Leave `/api/devhunt` and probably `/api/backtest` **unavailable** until a historical store exists (GT OHLCV can support a limited, recent, pool-level replay later — not the original 10-day walk-forward).

---

## 8. Strategy families that *can* be genuine

Keep **few, distinct, rule-based families** that only read metrics the feeds actually supply. Map them onto existing template ids where the name still fits; disable or hide the rest in config rather than faking signals.

Suggested v1 set:

1. **Momentum (`momentum`)** — `priceChange.m5` and `priceChange.h1` both above configurable floors, and `volume.m5` not tiny versus `volume.h1`.
2. **Volume spike (`volume`)** — `volume.m5` (or m5 txns) high relative to the h1 baseline (e.g. m5 volume > k × h1/12), with a minimum `liquidity.usd`.
3. **Launch / early pool (`early` or `launchdip`)** — `pairCreatedAt` within a configurable age window (e.g. 2–60 minutes) **and** liquidity/reserve above a floor. A **dip** variant also requires `priceChange.m5` below a negative threshold. Age alone is not a quality signal.
4. **Buy pressure (`crowd` / early-crowd style)** — `txns.m5.buys > sells` (DexScreener) and, when a sparse GT detail is available, unique `buyers` vs `sellers`. Still only a windowed print, not wallet identity.
5. **Narrative (`meta`)** — coin name/symbol matches a trending DexScreener meta, plus a liquidity floor. This is **word overlap**, not “the swarm reads X.”
6. **Curve / migration (`tobond` or `migdip`)** — only if GT `launchpad_details` was fetched: e.g. propose when `graduation_percentage` is in a band and `completed` is false (`tobond`), or after `completed` with a migrated pair and a post-migration dip. If the detail call was not made, this family stays silent.
7. **Quality / liquidity gate (shared, not a voter)** — every proposal must pass: non-null price, reserve/liquidity ≥ max(floor, 4× bag USD), notional ≪ reserve (see §9), feed not stale, mint not excluded.
8. **Control (`control`)** — optional, clearly labelled random or always-on-watchlist, so it is not mistaken for a researched edge.

Do **not** ship sniper-first-slot, caller-copy, smart-wallet, dev-burn, dev-lock, or X-talk families until a feed actually supports them.

Quorum can stay rule-based: e.g. `quorumNeed` distinct families inside `windowSec`, then the risk desk. With only ~6 voting families, do not pretend there are 500 agents. Generate a small, named set of rule variants per family (single-digit counts), and show them as paper agents.

---

## 9. Paper execution, fees, slippage, stale data, accounting

### Price vs fill

Aggregator `priceUsd` is a **last/reference price**, not a fill for 0.05 SOL. Liquidity is fragmented; impact on a new pump.fun curve can be large. Jupiter itself documents this distinction (price vs `GET /order` quote). v1 should **not** call swap-execute endpoints. A later optional Jupiter `GET /order` (no taker) could estimate impact, still without sending a transaction.

**Fill model (conservative):**

- Decision time uses the latest non-stale snapshot.
- The fill is delayed until the **next successful poll** (you do not have slots). Mark it as a delayed paper fill, not “2 slots later.”
- Fill price = **worse** of decision price and next mark (buy at the higher, sell at the lower) — adverse selection.
- Then apply fee and slippage (below).
- If the next poll is stale, missing, or reserve has collapsed, **cancel** the paper order; do not invent a fill.

Skip a buy if `bagUsd / liquidityUsd` exceeds a cap (suggest **2–5%**; reject above **10%** even if the user raises the cap).

### Fees and slippage (defaults, not venue truth)

Exact current pump.fun / PumpSwap / Raydium fee schedules were **not verified** in this pass. Defaults should be **configurable placeholders**, labelled as assumptions:

- Venue fee: **100 bps (1%) each way**.
- Slippage / impact floor: **max(150 bps, 2 × bagUsd / liquidityUsd)**, still subject to the 10% skip cap.
- Flat priority/tip: **0.002 SOL** per paper transaction (buy and sell).
- Implied round-trip often **~4–5%+** before adverse price move — in the same spirit as the template’s “~5% round-trip” copy, but **not a measured fee**.

Do not report paper PnL as if it were a live fill on pump.fun.

### Stale-feed guard

- Record `observedAt` from HTTP `Date` minus `Age` when present.
- Watchlist poll interval ≥ DexScreener cache: **30–45 s** (the template’s `pollMs: 15000` is faster than the observed 30 s cache and wastes budget).
- Discovery / GT: **at most 1 request per minute** for `new_pools`, and only occasional pool-detail calls. Never tight-loop GT.
- If the last good watchlist snapshot is older than **90 s**, or a 429/5xx is in backoff: **halt new buys**, keep marks frozen or clearly “stale,” do not emit confident ticks.
- Missing `priceUsd` or liquidity: no vote, no fill.
- Honour `Retry-After` / Jupiter `x-ratelimit-reset`; exponential backoff; no hammering.

### Reserve and daily-loss accounting

Use the template params as the desk, plus a virtual **trading reserve** (configurable, e.g. 2–5 SOL) that is **not** real funds.

- Starting reserve is cash (SOL units). A buy spends `bagSize + fee + tip` from cash and opens a position sized in tokens at the paper fill.
- **Exposure** = sum of position marks in SOL (use current mark after haircut, or cost if you want even more conservative exposure). Cap `maxExposure` (0.3 SOL) and `maxBagsPerCoin` (1).
- **Buys per hour:** rolling 60 minutes, cap 10.
- **Daily loss cap:** 1 SOL. Define the day in **Asia/Manila**, midnight to midnight, configurable. Count **realized + unrealized** (conservative). When `startOfDayReserve - (cash + marks) >= dayLossCap`, halt buys until the next local day (or until the user raises the cap).
- Never allow cash < 0. Reject a buy if cash cannot cover bag + fees + tip, or if any cap would be breached **including** the fee.
- High-water mark and “burn” copy can be displayed from paper profit, but must stay labelled paper; no chain transfer.
- Persist ledger, positions, and daily totals in a local JSON (or SQLite) file so a Windows restart does not reset the day.

`/api/chainbook` and explorer links should stay honest: paper rows have no real signature.

---

## 10. Practical Node-on-Windows shape

- One ESM process (same style as `serve.mjs`), Node 18+ for native `fetch`. Use `fileURLToPath(import.meta.url)` (the user already hit the Windows `pathname` bug).
- Zero or few dependencies so native addons do not fail on Windows. A JSON file store is enough for v1.
- Config (separate from, or extending, `site.config.js`): watchlist mints, `discovery.enabled`, poll intervals, fee/slippage/tip, reserve, min liquidity, family thresholds, Asia/Manila timezone for the day boundary.
- Loops: (1) Jupiter SOL every 30–60 s, (2) DexScreener `/tokens/v1` in batches of 30, (3) optional GT `new_pools` once a minute, adding **new mints** to a short-lived candidate list that is then priced on DexScreener, (4) sparse GT pool detail for curve families, (5) metas every 5–15 min.
- Identify a descriptive `User-Agent`; do not impersonate another app.
- Serve the adapter REST+SSE on localhost (e.g. port 8081) and point the template at `data.mode: 'live'` and `data.baseUrl`. Keep `fallback: 'none'`.
- CORS for the template origin only. **Do not** call DexScreener/GT/Jupiter from the browser as the system of record (rate limits are per IP; caching and accounting belong on the server). Official GT/Jupiter guidance is also aimed at server-side use for production.
- Log every vendor status code, cache header, and skip/halt reason.

Discovery must be described in the UI as “newest pools DexScreener/GeckoTerminal have indexed,” **not** “all pump.fun launches.”

---

## 11. Honest limitations (v1 will still not be)

- Not a complete pump.fun firehose. GT page 1 is ~20 newest indexed pools; DexScreener lists are not a launch stream. Pre-graduation coins may appear late, with null MC/FDV, or not at all. Some `pumpfun` DexScreener rows have no price.
- Not on-chain verification of devs, callers, drip buyers, slot crashes, or 25-slot volume.
- Not executable quotes or real fills. Marks from three vendors already differed by ~0.1% on SOL, and much more is possible on illiquid memes.
- Not 500 agents and not 19 honest families.
- Not a production market-data stack. Official GT keyless text says it is a poor fit for scheduled polling; DexScreener terms forbid building a competing screener; caches of 30–60 s are already baked in.
- No documented ATH; weak or null market cap on new tokens; FDV ≠ market cap when both exist.
- Backtest / dev-hunt / lab history are not provided by these endpoints in the form the dashboard currently describes.
- pump.fun official API, keyed CoinGecko, keyed Jupiter, and private RPC/indexer would change this picture — only after the user accepts sign-up, keys, and those products’ terms.

This research does **not** claim that any rule family is profitable.

---

## 12. Official URLs (checklist)

- DexScreener reference: https://docs.dexscreener.com/api/reference
- DexScreener WebSockets: https://docs.dexscreener.com/api/websockets
- DexScreener API terms: https://docs.dexscreener.com/api/api-terms-and-conditions
- CoinGecko keyless public API: https://docs.coingecko.com/docs/keyless-public-api
- GeckoTerminal public API notes: https://api.geckoterminal.com/docs/index.html
- GT / CoinGecko pool by address: https://docs.coingecko.com/reference/pool-address
- GT new pools by network: https://docs.coingecko.com/reference/latest-pools-network
- GT OHLCV: https://docs.coingecko.com/reference/pool-ohlcv-contract-address
- GT trades overview: https://docs.coingecko.com/reference/onchain-trades-overview
- Useful links / attribution: https://docs.coingecko.com/docs/useful-links
- Jupiter Price API: https://developers.jup.ag/docs/price
- Jupiter rate limits: https://developers.jup.ag/docs/portal/rate-limits
- pump.fun API (keyed, later only): https://docs.pump.fun/

---

## Addendum — what the shipped build does (written during implementation, 11 Nov 2026, ~12:30–13:10 Asia/Manila)

### Data source actually used
- **DexScreener only.** `GET /tokens/v1/solana/{up to 30 addresses}` for quotes, and optionally `GET /token-boosts/latest/v1` + `GET /token-profiles/latest/v1` for discovery. GeckoTerminal and Jupiter were **not** integrated (scope: one reliable source; GT keyless limits are too tight for polling; USD accounting removes the need for a SOL/USD reference).
- Rate limits re-checked against the official reference (https://docs.dexscreener.com/api/reference): token/pair/search group 300 req/min; profiles/boosts 60 req/min. The app makes **one** batched quote request per poll (default every 30 s, minimum allowed 30 s) plus one discovery pair of requests every 5 minutes. Typical load: ~2–3 requests/minute.
- Verified live from this box (11 Nov 2026 12:3x PM Asia/Manila): `/tokens/v1/solana/…` returned a bare JSON array, one pair per requested mint, `cache-control: public, max-age=30`; the boosts and profiles lists each returned 30 items (25–26 on Solana).
- Discovery lists are **paid promotions on DexScreener**; the UI and README say so and treat them only as a source of addresses to watch, never as a signal.
- Observed data-quality cases that the code handles: wrapped SOL has no `marketCap`/`fdv` (treated as missing, never substituted); one watchlist token (JTO) reported a market cap in the hundreds of billions. The app cannot verify such values; it only rejects market cap when it exceeds the feed's own FDV (impossible by definition) and never uses FDV in its place. Rows with null price or liquidity get no vote and no fill.

### Adopted from the research
- 90 s stale-quote guard (`market.maxQuoteAgeSeconds`), observation time = HTTP `Date` − `Age`.
- Delayed adverse fill: paper orders fill at the next **newer** quote at the worse of decision vs. next price; buys are cancelled if that quote is stale/missing/illiquid, sells wait.
- Conservative cost placeholders, labelled as assumptions: fee 100 bps per side + $0.50 flat per order; slippage max(150 bps, 2 × trade ÷ liquidity); trade refused above 2 % of pool liquidity (config max 10 %).
- Daily loss limit on realized + estimated unrealized equity, day boundary **Asia/Manila** (configurable).
- Persistence in a local JSON file with atomic write + backup.
- Small, distinct families on observed metrics only: momentum, volume pace, buy pressure, dip rebound, early pair (+ user-built agents). No dev/caller/smart-wallet/slot/ATH claims.

### Not adopted (and shown as UNAVAILABLE in the UI)
- Narratives (DexScreener metas exist but were left out to keep scope small), curve/migration families (needs GT pool detail), backtest (no historical data source), dev hunt, lab, holder agents, on-chain wallets.
