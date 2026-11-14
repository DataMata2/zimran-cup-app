# Penaltyproof product build plan

Spec: `/home/datamata/Projects/hackathons/zimran-business-cup/PRODUCT.md` (sections "Key scenario", "AI", "Done").
Jury rules: `/home/datamata/Projects/hackathons/zimran-business-cup/CASE.md` → "Case Q&A answers".
Engine API: `/home/datamata/Projects/hackathons/zimran-business-cup/engine/README.md`, types in `engine/src/types.ts`.

## Global Constraints

- Work only in the worktree `/home/datamata/Projects/hackathons/zimran-business-cup/app-product` (branch `product`). Commit there. Never push, never touch `main`, never touch `../app`.
- Next.js 16.4 App Router, React 19, Tailwind v4, TypeScript strict, pnpm. **This Next.js has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing routes, layouts, fonts, or route handlers.** Heed deprecation notices.
- File ownership. You may create/edit: `app/**` pages and components except `app/api/health`, `app/api/checkout*`, `app/api/stripe*`; `components/**`; `lib/tax/**`; `lib/product/**`; `docs/**`; test config. Do NOT create or edit `lib/supabase*`, `lib/stripe*`, `lib/ai*` (another session owns them). Adapters go in `lib/product/`.
- Adding a dependency: `pnpm add <pkg>`, then commit `package.json` + `pnpm-lock.yaml` alone in its own commit (`deps: add <pkg>`), before the code that uses it.
- The tax engine (`lib/tax/`) is a verbatim copy of `engine/src`. Never change its logic. If you think it has a bug, append it to `/home/datamata/Projects/hackathons/zimran-business-cup/engine/BUGS.md` and say so in your report.
- Every number the user sees comes from the engine (`estimate`, `annualized`, `setAsideForPayment`, `toICS`). No hardcoded tax numbers in UI code. The AI never calculates.
- UI copy in **English**, plain, calm, specific. No lorem ipsum, no placeholder text, no emoji in UI. **No dead buttons**: anything not working is hidden.
- Mobile-first: must look right at 375px wide and on desktop (≥1280px). No horizontal scroll at 375px.
- Look: calm, trustworthy fintech. Light theme only. Warm off-white background, near-black ink, ONE accent (deep green = "penalty-proof", safe), amber for "due"/warnings, red only for "past due". Tabular numerals for all money. Generous whitespace, 1 radius scale, subtle borders over heavy shadows. No gradient blobs, no stock illustrations.
- Money format: `$1,234` for whole-dollar display of big numbers (round to dollars), `$1,234.56` in tables/log. Dates like `Jan 15, 2027`.
- "Today" (`asOf`) = the browser's local date as ISO `YYYY-MM-DD`, clamped to `2026-01-01..2027-04-15`. Real today is 2026-11-14, so the next deadline is Q4, Jan 15, 2027.
- Secrets: env vars only (`.env.local` exists, gitignored). Never print, log, or commit a key.
- Disclaimer text wherever a tax number is shown in a result: "Estimate for tax year 2026, not tax advice."
- Tests: `pnpm test` (vitest) must pass; `pnpm lint` and `pnpm exec tsc --noEmit` clean; `pnpm build` must succeed at the end of each task.

## Product decisions (binding)

- Routes: `/` landing · `/start` quiz · `/plan` result + payment log + deadlines + paywall · `GET /api/ics?d=<base64url JSON TaxInput>` returns `text/calendar` attachment `penaltyproof-2026.ics` built with `toICS(estimate(input), { includeReturnDue: true })` · M2: `POST /api/explain`, `POST /api/read-payment`, `POST /api/ask`.
- Guest state (M1) lives in `localStorage` through `lib/product/store.ts` (keys `pp.v1.profile`, `pp.v1.log`, `pp.v1.pro`), exposed via `useSyncExternalStore` hooks. It is the adapter to be swapped for Supabase guest storage later, so keep its API small: `getProfile/setProfile`, `getLog/addLogEntry/removeLogEntry`, `isPro/setPro`, `resetAll`, and hooks `useProfile`, `useLog`, `usePro`. SSR-safe (server snapshot = null/empty).
- `Profile` (quiz answers): `{ filingStatus, state, ytdIncome, expectedIncome, w2Wages, w2Withholding, priorYearTax: number|null, priorYearAgi: number|null, estimatedPaid: number, createdAt: ISO, isExample: boolean }`.
- `LogEntry`: `{ id, kind: "income" | "irs", amount, payer: string, date: ISO date, createdAt }`. `kind:"income"` = "I got paid"; `kind:"irs"` = "I paid the IRS an estimated payment".
- `buildTaxInput(profile, log, asOf): TaxInput`: `ytd1099Income = profile.ytdIncome + Σ income entries`; `expectedAnnual1099Income = max(profile.expectedIncome, that ytd)`; `estimatedPaymentsMade`: if `estimatedPaid > 0` add `{date: max("2026-01-01", min(asOf, "2026-04-15")), amount}` (assumed paid on time), plus every `irs` entry `{date, amount}`; W-2 fields and prior-year fields passed through (`priorYearTax` null = unknown).
- Set-aside per logged income payment: `setAsideForPayment(result, amount)` computed with the result BEFORE that entry was added (the rate the user saw when they logged it); store the computed `setAside` on the entry (`setAside: number`) so history doesn't shift.
- Penalty-proof meter (the return mechanic): `covered = result.progress.annualPaid + Σ setAside of income entries`; `pct = min(100, covered / result.safeHarbor.requiredAnnualPayment × 100)` (100 if required is 0). Label `"Q<next quarter>: <pct>% penalty-proof"`. The bar shows two segments: paid to IRS (solid accent) and set aside (lighter accent / hatched), with Q1–Q4 tick marks at 25/50/75/100%. Under it: "Paid to IRS $A · Set aside $S · Safe-harbor target $T".
- Free tier: 3 logged entries total (income + irs). Adding a 4th opens the paywall. Pro = unlimited log, AI screenshot reading, annualized-income (Schedule AI) plan for lumpy income, "Ask why" chat, CSV export for an accountant. Price: **$9.99/month or $59 per tax year** (yearly highlighted as default). Paywall shows "Demo: use test card 4242 4242 4242 4242, any future date, any CVC."
- Example persona ("Try with an example"): Maya, freelance product designer in California, single. `ytdIncome 52000`, `expectedIncome 64000`, `w2Wages 0`, `w2Withholding 0`, `priorYearTax 7400`, `priorYearAgi 49000`, `estimatedPaid 3700` (covered Q1+Q2, missed Q3), `isExample true`, plus 1 pre-logged income entry `{amount 4200, payer "Northwind Studio", date 2026-11-03}`. The landing button goes straight to `/plan` with this loaded; a slim banner on /plan says "You're viewing an example. Start with your own numbers →".

## Task 1: Foundation — engine copy, product core, design system, landing

1. Copy `/home/datamata/Projects/hackathons/zimran-business-cup/engine/src/**` → `lib/tax/` verbatim. Copy the engine's 3 test files into `lib/tax/__tests__/` fixing only import paths. Add vitest (`pnpm add -D vitest`), `"test": "vitest run"` script, path alias `@/` working in tests. All 62 engine tests pass.
2. `lib/product/`: `types.ts` (Profile, LogEntry), `asof.ts` (todayIso clamp), `input.ts` (`buildTaxInput`), `meter.ts` (`penaltyMeter(result, log)` → `{ paid, setAside, target, pct, quarter }`), `format.ts` (`money`, `moneyCents`, `pct`, `longDate`), `example.ts` (persona above), `states.ts` (list of the engine's StateCodes with full names, sorted by name, from the engine constants — do not duplicate tax data), `store.ts` (localStorage adapter + hooks as above). Unit tests for `buildTaxInput`, `penaltyMeter`, `todayIso` clamp, `format`.
3. Design system: `app/globals.css` tokens (Tailwind v4 `@theme`), fonts via `next/font` (one clean sans for UI; tabular numerals), `components/kit/` (our UI kit; `components/ui/` is shadcn, owned by skeleton): `Button` (primary/secondary/ghost, sizes, link variant via `href`), `Card`, `Field` (label, hint, error, money input with `$` prefix and thousands formatting, numeric keyboard on mobile), `SegmentedControl`, `ProgressBar` (two-segment + ticks), `Badge` (paid/due/pastDue/upcoming), `Disclaimer`. `components/site/Header` (wordmark "Penaltyproof", no nav links that don't work) and `Footer` (disclaimer, "Not affiliated with the IRS", tax year 2026). Root layout metadata: title "Penaltyproof — never pay an IRS underpayment penalty", description.
4. Landing `/`: headline on the penalty (e.g. "Freelancer? The IRS charged 15.7 million underpayment penalties last year."), the stat "$12.06B in estimated-tax penalties, ~$766 each" with source "IRS Data Book FY2025, Table 4-2", a one-line promise (how much to set aside from every payment + the minimum to pay by each deadline), buttons "Get my number (no sign-up)" → `/start` and "Try with an example" → loads example, → `/plan`. A 3-step "how it works", a short "what you get" (big numbers preview), price teaser "$59 per tax year — less than one penalty". All above-the-fold on 375px: headline + both buttons. If a profile exists in the store, also show "Continue to my plan →".

Done: tests pass, lint/tsc/build clean, landing screenshot-worthy at 375 and 1280.

## Task 2: Quiz `/start`

One question per screen, progress bar at top ("Step 2 of 6"), Back button, Continue disabled until valid, Enter submits, autofocus. Steps:
1. Filing status: Single · Married filing jointly · Married filing separately · Head of household (big tap targets; `qss` not offered).
2. State: searchable select of all engine states (type-ahead), default none.
3. Freelance income: "Received so far in 2026" + "Expected for all of 2026" (helper: "Before taxes, after nothing — just what clients paid you."). Expected ≥ so far (auto-fill expected with so-far ×12/monthsElapsed as a suggestion placeholder only).
4. W-2 job (optional): toggle "I also have a W-2 job" → wages for 2026 + federal withholding for 2026. "Skip" allowed.
5. Last year's total tax: amount (help: "Form 1040, line 24") + last year's AGI (line 11), or "I don't know" → null both, with note "We'll use the 90% rule instead — a bit more conservative."
6. Estimated payments already made for 2026 (total), "None yet" quick option.
Finish → `setProfile` (isExample false, clears log) → `/plan`. Answers persist step by step in sessionStorage so refresh doesn't lose them. Validate with the engine: if `estimate()` throws `TaxInputError`, show the error on the right step.

## Task 3: `/plan` — result, payment log, deadlines, .ics

If no profile → redirect to `/start`. Compute `result = estimate(buildTaxInput(profile, log, todayIso()))` client-side (memoised).
Sections (mobile order):
1. Hero: "Pay **$X** by **Jan 15, 2027** to stay penalty-proof." (`nextDeadline.amountDue`; if `includesPastDue`, amber note "includes $Y you missed on Sep 15 — pay it now to stop the penalty growing"). If `nextDeadline` null or amount 0: "You're penalty-proof for 2026" state. Second big number: "Set aside **Y%** of every payment." (`setAside.rate`; if `catchUpRate` > rate show "Catching up? Set aside Z% of what's still to come."). Safe-harbor reason sentence (`safeHarbor.reason`).
2. Penalty-proof meter + payment log card: input row "I just got paid $___ from ___" + button "Log payment"; instantly shows "Set aside $Z from this payment" toast/inline confirmation and the meter animates. Secondary toggle "I paid the IRS" logs `irs` kind. List of entries (newest first) with set-aside, delete. Free counter "2 of 3 free entries used".
3. Deadlines: the 4 instalments as rows (quarter, due date, planned/required amount, status badge), and "Add all to calendar (.ics)" → `/api/ics?d=...`. Show the April 15, 2027 true-up row: "Estimated balance with your return: $N" (or refund).
4. Breakdown: SE tax / federal income tax / state tax (label "approximate" when `stateMethod === "approx"`), total, effective rate; show relevant `flags[].message` as small notes (dedupe, skip `credits_not_modeled` into the footnote).
5. "Edit my answers" → `/start` prefilled; "Start over" (confirm inline, not a browser dialog).
6. Example banner when `profile.isExample`.
7. Paywall sheet (component `components/plan/Paywall.tsx`) opened by the 4th log entry and by Pro feature buttons: plan comparison, price toggle, test-card note, CTA calls `startCheckout(plan)` from `lib/product/pro.ts` (M1: adapter that POSTs to `/api/checkout` and redirects to the returned `url`; if the route is missing or fails, show an inline error "Checkout is unavailable right now. Try again in a minute."). On return with `?pro=1`, the adapter verifies via whatever skeleton exposes (M2; for M1 leave a TODO-free stub that reads `pp.v1.pro`).
`/api/ics` route handler as specified in Product decisions, with input validation (400 on bad input).

## Task 4 (M2): AI explain, read-payment, ask-why

Load the `claude-api` skill first. Adapter `lib/product/ai.ts` (official `@anthropic-ai/sdk`, server-only, model `claude-sonnet-5-5`, key from `ANTHROPIC_API_KEY`) until skeleton's `lib/ai` exists; if `lib/ai.ts` exists on `main` by then, use it.
- `POST /api/explain` body `{ input: TaxInput }` → server recomputes `estimate(input)` (never trust client numbers) → streams 4–6 plain-English sentences explaining the result; system prompt: only use numbers present in the JSON, no advice beyond the estimate, second person, no headings. Plain-text stream. UI: "Why this number?" card on /plan streams on open, with retry on error.
- `POST /api/read-payment` body `{ text?: string, image?: { mediaType, dataBase64 } }` → `{ amount: number|null, payer: string|null, date: ISO|null }` via structured output/tool use; size limit 5 MB, image types png/jpeg/webp/gif. UI in the log: "Paste a payout email or upload a screenshot" → fills the log row for the user to confirm. Text paste is free; screenshot upload is Pro (paywall).
- `POST /api/ask` (Pro) body `{ input, log, messages }` → short grounded answer, refuses out-of-scope tax advice, appends "Estimate, not tax advice." Streamed. UI: small chat on /plan.
- Rate-limit-ish guard: reject bodies > 6 MB; per-IP simple in-memory counter (60/hour).

## Task 5 (M2): Pro — checkout wiring, annualized plan, CSV export

Wire `lib/product/pro.ts` to the skeleton's checkout and Pro status (read what exists on `main`: `/api/checkout*`, guest id, Pro flag). Pro unlocks immediately on return. Pro features: unlimited log; screenshot reading; "Lumpy income? Annualized plan" card using `annualized(input)` built from dated income entries (`payments1099`: log income entries + profile YTD spread as monthly equal amounts Jan..current month) showing regular vs annualized instalments and how much less is due now; CSV export of the log + instalments for an accountant.

## Task 6 (M3): Polish

Empty/error/loading states, 375px pass, keyboard/focus, metadata/OG image, favicon, README "Product" section, every visible button verified.
