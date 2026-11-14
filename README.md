# Penaltyproof

Penaltyproof tells US freelancers how much to set aside from every client payment and the minimum to pay the IRS by each quarterly deadline, so they never owe an underpayment penalty (tax year 2026). No sign-up: guest mode, a Stripe test-mode Pro plan, Supabase storage, and Claude explaining numbers that a verified tax engine computes. Built for Zimran Business Cup 2026.

## Product: Penaltyproof

### What it does

1. A US freelancer answers six questions (filing status, state, income so far and expected, W-2, last year's tax, what they've paid). No sign-up.
2. `/plan` shows two numbers: the minimum to pay the IRS by the next quarterly deadline (split into "pay now" for a missed quarter and the next instalment), and the share of every client payment to set aside.
3. Each time a client pays, they log it and see the set-aside in dollars and cents. Each IRS payment they log fills the meter: paid to the IRS against the legal minimum due so far.
4. Deadlines go to their calendar as an `.ics` file built in the browser.
5. Pro ($59 per tax year or $9.99 a month) adds unlimited logging, reading payouts from a screenshot, the annualized plan for uneven income, "Ask why" chat and a CSV for an accountant.

### How the numbers are made

The tax engine in `lib/tax/` (a verbatim copy of `engine/src`) computes everything: federal income tax, self-employment tax, state tax, the safe-harbor minimum (Form 1040-ES), the instalment schedule, the penalty estimate (Form 2210), the annualized method (Schedule AI), the set-aside rate and the calendar file. The UI only selects and formats its results (`lib/product/`). The AI never calculates. It explains numbers the engine already produced.

### AI features (Claude, server-side)

- **Why this number?** (`POST /api/explain`): a short plain-English explanation of your plan, streamed.
- **Ask about your numbers** (`POST /api/ask`, Pro): questions answered from your own plan and log.
- **Paste a payout email or screenshot** (`POST /api/read-payment`; screenshots need Pro): fills in amount, client and date for you to check before logging.

The model sees only display strings of the engine's results, plus filing status, state and the log (payer names cleaned). The prompts forbid arithmetic, and every dollar amount in an answer is checked against the `$`-amounts it was given; anything else is logged. Requests are rate-limited per guest and IP.

### Tests

`pnpm test`: 268 tests in 18 files. 71 are the engine's (`lib/tax/__tests__`, including four personas checked by hand against the IRS worksheet, see below); 197 cover the product layer: input building, the meter, pay-now split, quiz validation, storage, server copy, the guest cookie, Pro helpers, CSV, AI facts, guards and post-checks.

### Guest mode

No accounts. Answers and the payment log live in `localStorage` (`lib/product/store.ts`), with a copy on the server keyed by an anonymous guest cookie (`GET/PUT /api/plan-data`), restored into an empty browser. Pro status is stored per guest on the server (`GET /api/pro`).

### Try Pro

Checkout is Stripe test mode: card `4242 4242 4242 4242`, any future date, any CVC.

## Stack

- Next.js 16 (App Router, Cache Components, standalone output), TypeScript, Tailwind CSS v4, shadcn/ui
- Anthropic API (`@anthropic-ai/sdk`), Stripe Checkout (`stripe`), Supabase (`@supabase/supabase-js`)
- pnpm

## Run locally

```bash
pnpm i
cp .env.example .env.local   # fill in values
pnpm dev                     # http://localhost:3000
```

The app builds and runs without Supabase: `/api/health` reports supabase as "not configured" and every guest is on the Free plan.

## Environment variables

| Name | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Server-side key for Claude calls. |
| `STRIPE_SECRET_KEY` | Stripe secret key; must be a test-mode key. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (test mode); build-time. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/stripe/webhook`; webhook returns 503 when unset. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL; build-time. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key, used only on the server. |
| `APP_URL` | Public base URL for Stripe redirects; falls back to the request origin (honours `x-forwarded-host`/`-proto`). |
| `APP_PORT` | Host port for docker compose (default 3100, bound to 127.0.0.1). |

## Supabase

Run `supabase/schema.sql` in the Supabase SQL editor. It creates `guests` and `health_checks` with RLS enabled and no policies, so only the server (service role) can access them.

## Stripe (test mode only)

`lib/stripe.ts` refuses non-test keys. The Pro plan is a placeholder subscription created inline with `price_data`, so no Stripe products or prices need to exist. Pay with test card `4242 4242 4242 4242`, any future date, any CVC. Pro is recorded on `/checkout/success` and, if configured, by the `checkout.session.completed` webhook (both idempotent).

## Routes

- `/` landing, `/app` guest status, `/pricing` paywall, `/checkout/success` confirmation
- `POST /api/guest`, `POST /api/checkout`, `POST /api/stripe/webhook`, `GET /api/health`

## Server helpers

- `lib/ai.ts`: `getAnthropic()`, `MODEL`
- `lib/guest.ts`: `getGuestId()`, `getOrCreateGuestId()`
- `lib/supabase.ts`: `isSupabaseConfigured()`, `getSupabaseAdmin()`, `ensureGuest()`, `isPro()`, `setPro()`
- `lib/stripe.ts`: `getStripe()`, `PLANS`, `createCheckoutSession()`, `getOrigin()`, `formatPlanPrice()`

## Docker

```bash
cp .env.example .env   # fill in values
docker compose up -d --build
curl http://127.0.0.1:3100/api/health
```

The image runs the standalone `server.js` on port 3000. `NEXT_PUBLIC_*` values are passed as build args from `.env`.

## Verified against the IRS worksheet

We ran four freelancer personas (tax year 2026, as of Nov 14, 2026, Texas so federal only) through the engine and through the 2026 Form 1040-ES worksheet by hand, and through a popular free calculator for comparison. The engine matches the hand-done worksheet to the cent for all four.

"Required" is the required annual payment (Form 1040-ES line 12c). "Due by Jan 15" is what has to be paid by 2027-01-15 so that the Q4 instalment is not short, given that nothing has been paid yet.

| Persona | Engine (`estimate()`) | 1040-ES worksheet by hand | A popular free calculator | Diff / flag |
|---|---|---|---|---|
| **A** single, $60k 1099, 2025 tax $8k | Total tax **$12,037.20**. Required **$8,000** (100% of prior year). Due by Jan 15: **$8,000** (Q1–Q3 past due). With $2k paid on each of Apr 15, Jun 15 and Sep 15: **$2,000** | $12,037.20; $8,000; $2,000/qtr | Total $12,037. **"$2,708 each quarter"** = $10,833/yr (90% of current year) | Engine = hand to the cent. The calculator asks for **$2,833 too much** because it has no prior-year input. It also cannot take payments already made. |
| **B** MFJ, W-2 $85k with $7k withheld, spouse $25k 1099, 2025 tax $9k | $11,602.83. Required **$9,000**. Withholding counts as $1,750/qtr. Due by Jan 15: **$2,000** (Q1–Q3 short $500 each) | $11,602.83; $9,000; L14a $2,000, $500/qtr | Run 1 (W-2 entered as the spouse's): **"No", $0, "refund $1,341"**, because the calculator invented $12,943 of withholding. Run 2 (fields swapped): **"$860 each quarter"** = $3,442/yr | Engine = hand. Calculator run 2 asks for **$1,442 too much** (90% current minus withholding). Run 1 is wrong. |
| **C** single rideshare, $45k 1099 ($30k Sep–Dec), 2025 tax $4k | $8,579.50. Required **$4,000**. Regular: $1,000/qtr, due by Jan 15 **$4,000**. `annualized()`: **$801.90 / $801.90 / $801.90 / $1,594.31**, total $4,000 | $8,579.50; $4,000. Schedule AI by hand: 801.90 ×3, 1,594.31 | Total $8,579. **"$1,930 each quarter"** = $7,721.55/yr | Engine = hand, including Schedule AI. The calculator asks for **$3,722 too much**. It has no income-timing input. |
| **D** single, $220k 1099, 2025 tax $40k, 2025 AGI $180k | $57,783.35. Required **$44,000** (110%). Due by Jan 15: **$44,000** | $57,783.35; $44,000 | Total $57,784. **"$13,001 each quarter"** = $52,004/yr | Engine = hand. The calculator asks for **$8,004 too much**. |
