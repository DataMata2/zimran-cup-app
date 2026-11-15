# Penaltyproof: business model and sources

This is the fact-checked unit-economics model behind the pitch. Every input is either **[SRC]** (sourced,
opened on its primary page) or **[ASSUMP]** (our assumption, labelled). Every figure is in
[`model.csv`](model.csv) with its source link or the formula that produces it, so you can rebuild the numbers.
The infographic is [`../docs/business-model.svg`](../docs/business-model.svg).

Today the product is live with test-mode Stripe checkout. Every acquisition channel below is **Planned**.

**Short version:** LTV ≈ $50 per payer. Paid search does not pay back (LTV/CAC ≈ 0.2–0.5). Affiliates/partners and
in-product referral do (≈ 2.5×+). SEO is the cheap channel but is capped by search volume. $100M ARR = 1.37M payers
≈ 4.5% of the 30.5M returns with Schedule C business income. That is a stretch that only a distribution partner could
deliver. Search demand alone supports a profitable niche of tens of thousands of payers, not $100M.

## 1. The problem, in numbers

| Fact | Number | Source |
|---|---|---|
| Estimated-tax penalties the IRS charged individual taxpayers (counts assessments, not people) | **15,734,656 penalties, ≈ $12.06B, ≈ $766 each** | [IRS Data Book FY2025, Table 4-2](https://www.irs.gov/pub/irs-soi/25db-4-02-cp.xlsx), FY2025 |
| Growth of the penalty count | 14,204,564 / $7.00B (FY2023) → 15,734,656 / $12.06B (FY2025) | IRS Data Book FY2023 and FY2025 |
| Share of civil penalties on individual returns that are estimated-tax penalties | **1 in 3 (33.7%)** | IRS Data Book FY2025 |
| Returns with Schedule C business income | **30.48M**; 21.85M claim the SE-tax deduction | [IRS SOI Table 1.4, TY2023](https://www.irs.gov/pub/irs-soi/23in14ar.xls) |
| Self-employed adults whose income varies month to month | **58%** (vs 28% of employees) | [Federal Reserve, Economic Well-Being of U.S. Households in 2025, p. 31](https://www.federalreserve.gov/publications/files/2025-report-economic-well-being-us-households-202605.pdf) |
| The penalty can apply "even if you're due a refund" | qualitative | [IRS FAQ](https://www.irs.gov/faqs/estimated-tax/individuals/individuals-2) |

## 2. Price

**$59 a year or $9.99 a month** (Stripe subscriptions; test mode in the demo). North American median app prices are
$9.99/mo and $39.99/yr ([RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps/)).

| Product | Price | Bank link? | Platform |
|---|---|---|---|
| **Penaltyproof** | $9.99/mo or $59/year | No | Web, no install |
| TaxSet | Free; Pro $19.99/yr | No | iOS |
| TaxSetAside | $9.99/mo or $69.99/yr | No | iOS |
| Keeper | Standard $199/yr; Premium $399/yr | Yes | Web + apps |
| Found (a bank) | $0; Plus $35/mo or $315/yr | Is the bank | Web + apps |

Prices read on each vendor's own page or App Store page on 2026-11-14.

## 3. Inputs

| # | Input | Value | Mark | Source |
|---|---|---|---|---|
| P1 | Monthly price | $9.99 | product decision | the app |
| P2 | Yearly price | $59 | product decision | the app |
| R1 | Monthly plan, first renewal (month-1 retention), North America | 54.9% | [SRC] | [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps/) |
| R2 | Monthly plan, 12-month retention, Utilities (the category RevenueCat puts Finance in) / all apps | 10.3% / 8.2% | [SRC] | RevenueCat SOSA 2026 |
| R3 | Annual plan, first renewal, North America | 25.8% | [SRC] | RevenueCat SOSA 2026 |
| R4 | Annual plan 12-month retention by price: low / mid / high | 36% / 26% / 23% | [SRC] | RevenueCat SOSA 2026 |
| R5 | Plan mix sold, North America: yearly / monthly / weekly | 39.7% / 36.2% / 23.0% | [SRC] | RevenueCat SOSA 2026 |
| R6 | Refund rate, North America | 3.45% | [SRC] | RevenueCat SOSA 2026 |
| R7 | First-year revenue per payer, NA users (cross-check) | $26.07 | [SRC] | RevenueCat SOSA 2026 |
| C1 | Download→paid by day 35: hard paywall / freemium; NA median | 10.7% / 2.1%; 2.8% | [SRC] | RevenueCat SOSA 2026 |
| C2 | Trial→paid, NA median | 34.2% | [SRC] | RevenueCat SOSA 2026 |
| F1 | Stripe card fee + Stripe Billing | 2.9% + $0.30, + 0.7% | [SRC] | [stripe.com/pricing](https://stripe.com/pricing), [stripe.com/billing/pricing](https://stripe.com/billing/pricing) |
| A1 | claude-sonnet-5-5 price | $2 / $10 per M input/output tokens | [SRC] | [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| A2 | AI usage per Pro user per month: 4 explanations, 8 screenshot reads, 10 chat messages | ≈ $0.15 (≈ $0.19 with full-resolution screenshots) | [ASSUMP] usage, [SRC] price | — |
| G1 | Google CPC, volume-weighted over 7 intent keywords (73,680 searches/mo) | $4.15 (e.g. "estimated tax payments" 27,100/mo, $3.83) | [SRC, 3P estimate] | [seodata.dev](https://www.seodata.dev/keyword/estimated-tax-payments) ("from the Google Ads API") |
| G2 | Google Ads Finance & Insurance median CPC / conversion rate (2026) | $3.39 / 2.64% | [SRC] | [WordStream/LocaliQ 2026](https://www.wordstream.com/blog/2026-google-ads-benchmarks) |
| M1 | Facebook, Finance & Insurance traffic-campaign CPC (US, 2025) | $1.22 | [SRC] | [WordStream Facebook benchmarks 2025](https://www.wordstream.com/blog/facebook-ads-benchmarks-2025) |
| AF1 | Affiliate payouts paid by incumbents | Keeper "up to $50" per signup; FreshBooks "up to $200 per paid subscriber"; QuickBooks "$25 to $300" | [SRC] | [Keeper](https://keepertax.com/become-an-affiliate), [FreshBooks](https://www.freshbooks.com/affiliate-program), [QuickBooks](https://quickbooks.intuit.com/partners/qbbusinessaffiliates/) |
| D1 | Comparable consumer-fintech CAC | Dave: $20 per new member (Q4 2025), $22 (Q3 2026) | [SRC] | [Dave Q4 2025 release](https://dave.com/press/news-releases/news-release-details/dave-reports-fourth-quarter-full-year-2025-financial-results), [SEC 8-K](https://www.sec.gov/Archives/edgar/data/0001841408/000119312526447333/dave-ex99_1.htm) |
| K1 | Click (or landing visit) → paid | base 2.0%, optimistic 4.0% | **[ASSUMP]**, anchored on C1: a freemium app converts 2.1% of *downloads*, and a click is a weaker commitment than a download | — |

## 4. LTV per payer (12–24-month horizon, after fees, AI and refunds)

**Monthly plan ($9.99)**
- Net per paid month = 9.99 − 0.66 (Stripe: 3.6% + $0.30) − 0.19 (AI) = $9.14; × (1 − 3.45% refunds) = **$8.82**.
- Paid months in year 1: month 1 = 1.0, month 2 = 54.9% (R1), then a geometric decay to the 12-month retention (R2).
  With 8.2% (all apps) that gives **3.8 paid months**; with 10.3% (Utilities), 4.0.
- LTV (year 1 only; no credit for the year-2 tail) = 3.8 × 8.82 = **≈ $33.5**.
- Sanity check: RevenueCat's NA first-year revenue per payer is $26.07 (R7, all plan types). Our $9.99 × 3.8 = $38
  gross is above that median, which is plausible but optimistic.

**Yearly plan ($59)**
- Net per charge = 59 − 2.42 (Stripe) − 2.28 (AI at $0.19 × 12 months, an upper bound) = $54.30; × 0.9655 = **$52.43**.
- One renewal at 25.8% (R3; $59 sits above the NA annual median of $39.99, so the high-price tier of R4 applies and the
  rate is not optimistic). LTV = 52.43 × 1.258 = **≈ $66** (no credit for later renewals).

**Blended**
- Mix: R5 renormalised without weekly plans (we sell none): 52% annual, 48% monthly ([SRC] mix, applied to our two plans as an [ASSUMP]).
- **Blended LTV = 0.52 × 66 + 0.48 × 33.5 ≈ $50.**
- Support: 20 min/yr at $25/h = $8.33 per payer [ASSUMP]; **LTV ≈ $44 incl. support**.
- Gross margin per payment after Stripe and AI: 92% on monthly, 92% on annual. Hosting is negligible at this scale and left out.

## 5. CAC, LTV/CAC and payback by channel (all Planned)

CAC = cost per click ÷ (click → paid), unless stated otherwise. Payback = CAC ÷ net per paid month ($8.82). A yearly
payer pays $52.43 net on day 1, so any CAC below ~$45 incl. support ($52.43 − $8.33) is paid back immediately for that payer.

| Channel | CAC arithmetic | CAC | LTV/CAC (LTV $50) | Payback | Verdict |
|---|---|---|---|---|---|
| Google search, intent keywords | $4.15 ÷ 2.0% (base) / ÷ 4.0% (opt.) | **$208 / $104** | **0.24 / 0.48** | never within LTV | Doesn't pay. Breaking even needs 8.3% of clicks to pay (4.15 ÷ 50). Use only for deadline-week retargeting, if at all |
| Google, F&I median CPC (cross-check) | $3.39 ÷ 2.0% / 4.0% | $170 / $85 | 0.29 / 0.59 | never | Same conclusion |
| Meta (FB/IG) traffic | $1.22 ÷ 2.0% / 4.0% | **$61 / $31** | **0.82 / 1.6** | 6.9 mo / immediate on annual | Borderline. Breaking even needs 2.4% click→paid. Test in deadline weeks |
| SEO: free calculator pages + IRS-deadline content calendar | fixed cost ÷ payers. [ASSUMP] $3,000/mo for content and tools; [ASSUMP] we capture 5% of the 73,680 searches/mo (G1) = 3,684 visits/mo × 2.0–4.0% = 74–147 payers/mo | **$41 / $20** | **1.2 / 2.5** | 4.6 mo / 2.3 mo | Best organic channel; ramp takes months; seasonal (Google Trends: April peak ≈ 6× the median week) |
| Affiliates / partners (freelancer communities, newsletters, bookkeepers) | CAC = the payout we set. [ASSUMP] $20 (34% of $59). Incumbents pay $50–$300 (AF1), so ours is a low bid | **$20** | **2.5** | 2.3 mo (monthly) / immediate (annual) | Pays. The risk is volume: our bounty is below Keeper's $50 |
| In-product referral ("give a friend a free month") | [ASSUMP] cost = one month forgone ≈ $8.82 per referred payer | **≈ $9** | **≈ 5.6** | 1 mo | Pays; no volume benchmark; treat as upside |
| Comparable sanity check | Dave $20–22 per new member (D1) | — | — | — | Shows a ~$20 CAC is achievable in consumer fintech; not per paying user |

**In one line:** we don't buy search clicks. Search costs $4 a click and would cost $100–200 per payer against a $50 LTV.
We grow through free calculator pages timed to the four IRS deadlines, freelancer communities and affiliates at about a
$20 bounty (incumbents pay $50–$300), and in-product referral. Target blended CAC ≤ $25, LTV/CAC ≈ 2×, and payback on
day 1 for yearly payers.

## 6. Path to $100M ARR (a stretch)

- ARR per active payer: annual $59; monthly $9.99 × 12 = $119.88. Plans sold 52/48 → ≈77% annual among active payers;
  **≈ $73 ARR per active payer** (0.77 × $59 + 0.23 × $119.88).
- **Payers needed: $100M ÷ $73 ≈ 1.37M payers ≈ 4.5% of 30.5M returns with Schedule C** (all-annual: $100M ÷ $59 ≈ **1.69M**).
- Target population: 30.48M TY2023 returns with Schedule C; 21.85M claiming the SE-tax deduction; 15.73M
  estimated-tax penalties assessed in FY2025 (all individual returns, a count of assessments, not people).
  **1.37–1.69M = 4.5–5.6% of Schedule C returns, or 6.3–7.8% of SE-tax returns.**
- Comparable: Rocket Money has 4.583M paying subscribers (YE2025) and $351M subscription revenue
  ([Rocket Companies 10-K FY2025](https://www.sec.gov/Archives/edgar/data/1805284/000162828026013283/rkt-20251231.htm)).
- **Churn makes it harder:** about 74% of annual payers and about 90% of monthly payers are gone within a year (R2, R3).
  Holding 1.37M payers therefore needs roughly **≈ 1.7–2M new payers a year** (15 vs 12-month annual stay). At a $20 CAC
  that is about $34–40M/yr in acquisition, which is affordable against $100M revenue. The problem is volume:
  - The seven core keywords total ≈ 884k searches a year. At 100% capture and 2–4% conversion that is 18–35k payers a
    year, **≈ 1–2% of the adds needed**. Search intent alone caps us at a profitable niche of ≈ $1–3M ARR.
  - So $100M needs (a) **Planned:** a distribution partner that reaches freelancers at the moment they are paid (payout
    platforms, freelancer marketplaces, invoicing tools), (b) **Planned:** higher ARPU (a Pro+ tier with state estimates,
    a CPA review or filing hand-off; Keeper charges $199–$399/yr and Found Plus $315/yr) and (c) better renewal than the
    benchmark, because the product is tied to the tax year and the April deadline is the renewal moment.
- **Planned: year 1 goal 10k payers (≈ $0.73M ARR)**: 10k payers × $73; an arithmetic target, not a forecast.

## 7. Sensitivities

- If annual renewal reaches the Business-category 39.9% instead of 25.8%: annual LTV becomes 52.43 × 1.399 ≈ $73 and blended LTV ≈ $54.
- If click→paid reaches the hard-paywall level (10.7%): Google CAC = $39 and LTV/CAC ≈ 1.3. A hard paywall is out,
  though: the free estimate is our acquisition hook.
- If the AI usage is 3× our estimate: AI cost ≈ $0.57/mo, and LTV drops by about $1.5. AI cost is not a risk to the model.

## 8. Not verified / left out

- No Finance category exists in RevenueCat or Adapty; Utilities (where RevenueCat files Finance) and Business are proxies.
- All RevenueCat numbers are for mobile app subscriptions; we are web. RevenueCat: web is 4.9% of NA revenue.
  Web-specific retention benchmarks (Recurly: 3.60% churn overall, 4.29% for $10–25/mo plans; the page calls these
  "annual", but the values only make sense as monthly) are noted, not used.
- Every click→paid and SEO share figure is an assumption. Funnel numbers from our own production analytics should replace them.
- Upwork freelancer counts and Found affiliate payouts could not be verified.
