# Placeholder

Placeholder product for Zimran Business Cup 2026. This repo currently holds the production plumbing only: guest mode (no sign-up), a Stripe test-mode paywall, Supabase storage and a health check. Product pages come later.

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
