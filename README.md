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
