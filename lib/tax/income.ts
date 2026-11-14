// Input normalization and freelance-income resolution (YTD, full-year, projection, income by date).

import { BRACKETS, RETURN_DUE, type FilingStatus } from "./constants/federal2026";
import { STATES } from "./constants/states2026";
import { assertIsoDate, daysSinceYearStart, inTaxYear, YEAR_START, yearFractionElapsed } from "./dates";
import { TaxInputError } from "./errors";
import { sum } from "./money";
import type { DatedAmount, NormalizedInput, TaxInput } from "./types";

/** Filing statuses whose W-2 wages may belong to a spouse who is not the self-employed person (QSS files alone). */
const JOINT: readonly FilingStatus[] = ["mfj"];

export function isJoint(status: FilingStatus): boolean {
  return JOINT.includes(status);
}

function money(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TaxInputError(field, `must be a finite number ≥ 0 (got ${String(value)})`);
  }
  return value;
}

function dated(list: unknown, field: string): DatedAmount[] | null {
  if (list === undefined || list === null) return null;
  if (!Array.isArray(list)) throw new TaxInputError(field, "must be an array");
  const out = list.map((p: unknown, i): DatedAmount => {
    if (!p || typeof p !== "object") throw new TaxInputError(`${field}[${i}]`, "must be an object { date, amount }");
    const entry = p as { date?: unknown; amount?: unknown };
    assertIsoDate(entry.date as string, `${field}[${i}].date`);
    const amount = money(entry.amount, `${field}[${i}].amount`);
    if (amount === null) throw new TaxInputError(`${field}[${i}].amount`, "is required");
    return { date: entry.date as string, amount };
  });
  // Stable sort by date (ISO dates sort as strings).
  return out
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.date < b.p.date ? -1 : a.p.date > b.p.date ? 1 : a.i - b.i))
    .map((x) => x.p);
}

/**
 * Validate the input and apply defaults. The result has every key present (JSON-safe).
 * Throws TaxInputError on: unknown filing status or state, malformed or impossible dates, asOf outside
 * 2026-01-01..2027-04-15, NaN / infinite / negative amounts, null array entries, a non-boolean priorYearFullYear.
 */
export function normalizeInput(input: TaxInput): NormalizedInput {
  if (!input || typeof input !== "object") throw new TaxInputError("input", "must be an object");
  const status = input.filingStatus as FilingStatus;
  if (typeof status !== "string" || !Object.prototype.hasOwnProperty.call(BRACKETS, status)) {
    throw new TaxInputError("filingStatus", `unknown filing status "${String(input.filingStatus)}"`);
  }
  if (typeof input.state !== "string" || !Object.prototype.hasOwnProperty.call(STATES, input.state)) {
    throw new TaxInputError("state", `unknown state "${String(input.state)}"`);
  }
  assertIsoDate(input.asOf, "asOf");
  if (input.asOf < YEAR_START || input.asOf > RETURN_DUE) {
    throw new TaxInputError("asOf", `must be between ${YEAR_START} and ${RETURN_DUE} (got ${input.asOf})`);
  }
  if (input.priorYearFullYear !== undefined && input.priorYearFullYear !== null && typeof input.priorYearFullYear !== "boolean") {
    throw new TaxInputError("priorYearFullYear", `must be true or false (got ${String(input.priorYearFullYear)})`);
  }
  const w2Wages = money(input.w2Wages, "w2Wages") ?? 0;
  // Who earned the W-2 wages matters only for the Social Security wage base (Schedule SE line 8a counts the
  // self-employed person's own wages). On a joint return they may be the spouse's: default to 0 (conservative,
  // never understates SE tax) and flag it; on other returns the wages are the filer's own.
  const ownWages = money(input.w2WagesOfFreelancer, "w2WagesOfFreelancer");
  return {
    filingStatus: status,
    state: input.state,
    asOf: input.asOf,
    ytd1099Income: money(input.ytd1099Income, "ytd1099Income"),
    expectedAnnual1099Income: money(input.expectedAnnual1099Income, "expectedAnnual1099Income"),
    payments1099: dated(input.payments1099, "payments1099"),
    businessExpenses: money(input.businessExpenses, "businessExpenses") ?? 0,
    w2Wages,
    w2Withholding: money(input.w2Withholding, "w2Withholding") ?? 0,
    w2WagesOfFreelancer: ownWages ?? (isJoint(status) ? 0 : w2Wages),
    w2OwnerAssumed: ownWages === null && isJoint(status) && w2Wages > 0,
    priorYearTax: money(input.priorYearTax, "priorYearTax"),
    priorYearAgi: money(input.priorYearAgi, "priorYearAgi"),
    priorYearFullYear: input.priorYearFullYear ?? true,
    estimatedPaymentsMade: dated(input.estimatedPaymentsMade, "estimatedPaymentsMade") ?? [],
  };
}

/**
 * Estimated payments that count: dated from Jan 1 of the tax year through asOf. Later-dated payments have not
 * been made yet (crediting them would hide an underpaid instalment); earlier-dated ones are not for this year.
 */
export function splitEstimatedPayments(n: NormalizedInput): { credited: DatedAmount[]; ignored: DatedAmount[] } {
  const ok = (p: DatedAmount) => p.date >= YEAR_START && p.date <= n.asOf;
  return {
    credited: n.estimatedPaymentsMade.filter(ok),
    ignored: n.estimatedPaymentsMade.filter((p) => !ok(p)),
  };
}

/** Projections from fewer days than this are flagged as unreliable (a product threshold, not a tax rule). */
export const PROJECTION_EARLY_DAYS = 60;

export interface FreelanceIncome {
  /** Net (after business expenses) freelance income for the full year; negative = loss. */
  netAnnual: number;
  /** Net freelance income through asOf. */
  netYtd: number;
  /** Full-year figure was extrapolated from YTD income. */
  projected: boolean;
  /** expectedAnnual1099Income was below income already received; the received amount was used. */
  expectedBelowYtd: boolean;
  /** Net income from Jan 1 through the end of `date` (used by Schedule AI). */
  cumulativeNet: (date: string) => number;
  /** No dated payments: income by date assumes an even spread. */
  evenSpread: boolean;
  /** Neither payments nor YTD were given: YTD is the full-year figure spread evenly by day. */
  ytdAssumed: boolean;
  /** Projected from fewer than PROJECTION_EARLY_DAYS days of income. */
  projectionEarly: boolean;
}

/**
 * Resolve freelance income.
 *  - Dated payments (if given) replace ytd1099Income: YTD = payments in 2026 dated ≤ asOf.
 *  - Full year = expectedAnnual1099Income (never below what is already known); otherwise projected as
 *    YTD ÷ (fraction of the year elapsed), the PLAN's `ytd / (dayOfYear/365)`.
 *  - businessExpenses (annual) are subtracted from the full year and accrue evenly over the year for YTD.
 *  - One timing model, `cumulativeNet(date)`, serves both estimate() (YTD = cumulativeNet(asOf), not below 0)
 *    and annualized() (income to each Schedule AI period end), so the two always agree.
 */
export function resolveIncome(n: NormalizedInput): FreelanceIncome {
  const fracAsOf = yearFractionElapsed(n.asOf);
  const payments = n.payments1099 ? n.payments1099.filter((p) => inTaxYear(p.date)) : null;
  const ytdGross = payments ? sum(payments.filter((p) => p.date <= n.asOf).map((p) => p.amount)) : (n.ytd1099Income ?? 0);
  const knownTotal = payments ? sum(payments.map((p) => p.amount)) : ytdGross;

  let annualGross: number;
  let projected = false;
  let expectedBelowYtd = false;
  if (n.expectedAnnual1099Income !== null) {
    annualGross = Math.max(n.expectedAnnual1099Income, knownTotal);
    expectedBelowYtd = n.expectedAnnual1099Income < knownTotal;
  } else if (fracAsOf > 0 && fracAsOf < 1 && ytdGross > 0) {
    annualGross = Math.max(knownTotal, ytdGross / fracAsOf);
    projected = true;
  } else {
    annualGross = knownTotal;
  }

  const expenses = n.businessExpenses;
  const unknownFuture = Math.max(0, annualGross - knownTotal);

  const cumulativeGross = (date: string): number => {
    const f = yearFractionElapsed(date);
    // Nothing known about timing (no payments, no YTD): the full year is assumed earned evenly.
    if (!payments && n.ytd1099Income === null) return annualGross * f;
    const known = payments
      ? sum(payments.filter((p) => p.date <= date).map((p) => p.amount))
      : fracAsOf > 0
        ? ytdGross * Math.min(1, f / fracAsOf)
        : 0;
    // Income not yet received is spread evenly over the rest of the year (over the whole year if none is left).
    const share = fracAsOf < 1 ? Math.max(0, f - fracAsOf) / (1 - fracAsOf) : f;
    return known + unknownFuture * share;
  };

  const cumulativeNet = (date: string) => cumulativeGross(date) - expenses * yearFractionElapsed(date);
  return {
    netAnnual: annualGross - expenses,
    netYtd: Math.max(0, cumulativeNet(n.asOf)),
    projected,
    expectedBelowYtd,
    cumulativeNet,
    evenSpread: payments === null,
    ytdAssumed: payments === null && n.ytd1099Income === null,
    projectionEarly: projected && daysSinceYearStart(n.asOf) + 1 < PROJECTION_EARLY_DAYS,
  };
}
