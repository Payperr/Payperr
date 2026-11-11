# Payper copy research

**Date of research:** 11 November 2026 (Asia/Manila)
**Purpose:** set a voice for the Payper website rewrite that reads as professionally edited and expensive *through clarity*, not through luxury adjectives, while staying exact about what the product is: a paper-trading record kept in virtual US dollars on live DexScreener quotes.

Method: each page below was opened and read in full (not search snippets). Notes record what each source does well, what to avoid, and how it shaped Payper's copy. No slogans or sentences were copied from any source.

## Sources read

| # | Source (URL) | Type | What we observed | What Payper takes from it |
|---|---|---|---|---|
| 1 | Our World in Data, About: https://ourworldindata.org/about and FAQs: https://ourworldindata.org/faqs | Editorial / research publisher | Mission stated in one plain sentence. Every chart attributed to a named source. Licensing and editorial independence stated directly, without adjectives. | Name the data source every time it matters ("Market data: DexScreener public API"). State what the site is in one sentence. Let attribution do the work that adjectives usually try to do. |
| 2 | Kenneth R. French Data Library: https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html | Academic data library | Methodology is documented and dated. Changes are logged. Missing data is flagged, never filled in. It says plainly that historical returns can change. | Write evidence copy as a method record: what was observed, when, and under which rule. Unavailable sections say *why* they are blank ("Left blank on purpose. Nothing here is simulated."). |
| 3 | AQR, Research library: https://www.aqr.com/Insights/Research | Institutional asset manager | Dated, abstract-style summaries. Claims are hedged ("may", "suggests"). A prominent notice warns about impostors and fraud using the firm's name. | Use a calm, factual tone for a high-stakes warning. This shaped the token panel's calm tone. Unlike AQR, Payper cannot speak for addresses beyond its own configuration, so its copy says only: "No token address has been published on this site. Verify the official address before trading." |
| 4 | U.S. SEC, Marketing Compliance FAQ (page updated 15 Jan 2026): https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/marketing-compliance-frequently-asked-questions | Regulator guidance | Gross versus net performance, equal prominence for both, a clearly disclosed time period, and caution around hypothetical performance. | Fees and slippage are named wherever paper P&L appears. "Simulated" and "virtual" sit next to the numbers they qualify, not in a footnote. No performance framing. |
| 5 | Interactive Brokers, free trial / paper account: https://www.interactivebrokers.com/en/trading/free-trial.php | Broker | Describes the paper account in operational terms: prices and values follow actual market conditions. Market-data delays are disclosed (10–15 minutes). Its headline still says "risk free", a phrase Payper does not use. | Describe the mechanism, not the feeling: "Prices are live from DexScreener. Every balance, position and trade here is virtual." State quote age wherever it matters. |
| 6 | Stripe, Payments: https://stripe.com/payments | Financial infrastructure | Short verb-led headings, concrete nouns, specific numbers. Little decoration. | Verb-led, concrete section copy ("From live quote to paper fill, one observation at a time"). Every claim is something the page can show. |
| 7 | Kaiko: https://www.kaiko.com | Institutional crypto data | Process language ("read, compute, store, distribute") and specific compliance references are strong. It slips into filler ("smart data") in places. | Use process words for the pipeline ("Decision path": signal, consensus, quorum, risk, fill). Avoid branded-adjective filler. |
| 8 | Two Sigma: https://www.twosigma.com | Quant investment firm | A restrained, scientific register ("rigorous inquiry"), diluted in places by AI vocabulary. | A restrained register, without AI vocabulary. Payper's agents are described as rule-based, never as intelligent or autonomous. |
| 9 | GOV.UK style guide, A to Z: https://www.gov.uk/guidance/style-guide/a-to-z | Public-sector editorial standard | Active voice, plain words, abbreviations explained once, sentence case. | Sentence case in headings. Active voice. Define "PAPER" and "virtual USD" once and use them the same way everywhere. |

### Read as counter-examples (patterns deliberately avoided)

| Source (URL) | Observed pattern | Why Payper avoids it |
|---|---|---|
| Coin Metrics: https://coinmetrics.io | Institutional design, but hero copy built on verbs like "Unlock superior…" | Promises an outcome instead of describing a capability. |
| Koyfin: https://www.koyfin.com | Adjective-heavy lines ("radiant views", "infinite insight", "unleash new potential and profits") | Profit language and adjective stacking read as cheaper, not more premium. They would also breach Payper's no-earnings rule. |
| TradingView, paper trading help: https://www.tradingview.com/support/solutions/43000516466-paper-trading-main-functionality/ | Claims the paper execution experience is "identical to real trading" and calls paper trading "risk-free" | Payper's fills are estimates from one quote, with assumed slippage and fees. We say exactly that, and never claim parity with live execution. |

### Attempted but not readable from this environment

Bloomberg Terminal pages (robot check), Financial Times (HTTP 403), Morningstar (empty 202 response), Vanguard (404 on the page tried), GOV.UK "tone" page (redirected to an empty page). Nothing from these sources was used. The table above lists only pages that were actually read.

## Voice principles adopted for Payper

1. **Expensive through clarity.** Short declarative sentences. One idea per sentence. No stacked adjectives.
2. **The record speaks.** Copy describes what is recorded, observed and checked. It never says what the user might gain.
3. **Qualifiers sit next to the numbers.** "Paper", "virtual USD", "simulated fill", "estimate", "fees and assumed slippage included".
4. **Absence is stated, not hidden.** Unavailable features start with "Unavailable:" and give the reason in one line.
5. **Calm warnings.** Security and token-spoofing notices are plain and specific, with no alarm vocabulary.
6. **Claim only what the site knows.** The site knows its own configuration and the data it retrieved. It does not state facts about the wider chain, about other people's addresses, or about prices beyond the latest retrieved quote. A "recent quote" means data retrieved within the age limit, not necessarily the last trade.
7. **Literal over reassuring.** "No results are shown. This feature is not available." is preferred to any sentence that defends the blank space.
8. **Sentence case, active voice, consistent nouns:** desk, agent, strategy family, quorum, risk check, paper fill, ledger.

## Vocabulary not used

unlock, elevate, redefine, "nothing here is simulated", "fresh quote" (in user copy), "the future of", revolutionary, seamless, cutting-edge, next-gen, empower, harness, leverage, AI-powered, autonomous, smart money, alpha, guaranteed, risk-free, passive income, and any earnings, yield, airdrop or reward language. `tests/copy.test.mjs` enforces this list across all website text and the preview.
