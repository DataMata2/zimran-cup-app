// The /start quiz as pure logic: the draft of answers, per-step validation, draft → Profile, the
// income suggestion, and mapping an engine TaxInputError back to the step that caused it.
// No tax figures are computed here; the engine validates the finished answers (see `checkWithEngine`).

import { estimate, TaxInputError, type FilingStatus, type StateCode } from "@/lib/tax";
import { money, moneyPay } from "./format";
import { buildTaxInput } from "./input";
import { isStateCode } from "./states";
import type { LogEntry, Profile } from "./types";

export const QUIZ_STEPS = 6;
export type QuizStep = 1 | 2 | 3 | 4 | 5 | 6;

/** Filing statuses the quiz offers (qualifying surviving spouse is not offered). */
export const QUIZ_FILING_STATUSES = ["single", "mfj", "mfs", "hoh"] as const satisfies readonly FilingStatus[];
export type QuizFilingStatus = (typeof QUIZ_FILING_STATUSES)[number];

/** The answers so far. null = not answered yet. Saved to sessionStorage after every change. */
export interface QuizDraft {
  v: 1;
  step: QuizStep;
  /** Prefilled from a saved profile ("Edit my answers"): finishing keeps the payment log. */
  editing: boolean;
  /**
   * Editing only: income already logged on /plan (sum and count). In edit mode "Received so far" shows the
   * true total (profile + logged), so on save the logged part is taken back out (see `draftToProfile`).
   */
  loggedIncome: number;
  loggedCount: number;
  /**
   * Editing only: IRS payments already logged on /plan (sum). The field holds only what was paid before
   * logging (profile.estimatedPaid); the logged IRS payments stay in the log and are never re-entered here
   * (one source of truth). See `paidSoFarNote` for the sum line.
   */
  loggedIrs: number;
  filingStatus: QuizFilingStatus | null;
  state: StateCode | null;
  ytdIncome: number | null;
  expectedIncome: number | null;
  hasW2: boolean;
  w2Wages: number | null;
  w2Withholding: number | null;
  /** false = "I don't know" last year's numbers. */
  priorKnown: boolean;
  priorYearTax: number | null;
  priorYearAgi: number | null;
  estimatedPaid: number | null;
}

export function emptyDraft(): QuizDraft {
  return {
    v: 1,
    step: 1,
    editing: false,
    loggedIncome: 0,
    loggedCount: 0,
    loggedIrs: 0,
    filingStatus: null,
    state: null,
    ytdIncome: null,
    expectedIncome: null,
    hasW2: false,
    w2Wages: null,
    w2Withholding: null,
    priorKnown: true,
    priorYearTax: null,
    priorYearAgi: null,
    estimatedPaid: null,
  };
}

/** Sum and count of the "I got paid" entries in a log. */
export function loggedIncomeOf(log: readonly LogEntry[]): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const e of log) {
    if (e.kind === "income") {
      total += e.amount;
      count += 1;
    }
  }
  return { total, count };
}

/** Sum of the "I paid the IRS" entries in a log. */
export function loggedIrsOf(log: readonly LogEntry[]): number {
  let total = 0;
  for (const e of log) if (e.kind === "irs") total += e.amount;
  return total;
}

export const PAID_SO_FAR_LABEL = "Paid so far for 2026";
/** The label while editing with IRS payments in the log: the field is only what was paid before the log. */
export const PAID_BEFORE_LOG_LABEL = "IRS payments made before you started logging here";

/** The step-6 field label (SHARED-01). */
export function paidSoFarLabel(draft: QuizDraft): string {
  return draft.editing && draft.loggedIrs > 0 ? PAID_BEFORE_LOG_LABEL : PAID_SO_FAR_LABEL;
}

/** Step 6's subtitle while editing with IRS payments in the log (R8-1): the field is not the grand total. */
export const PAID_BEFORE_LOG_LEAD =
  "Only what you paid the IRS before you started logging here. Payments in your log are added for you.";

/** Step 6's subtitle override, or undefined to keep the usual one (same condition as `paidSoFarLabel`). */
export function paidSoFarLead(draft: QuizDraft): string | undefined {
  return draft.editing && draft.loggedIrs > 0 ? PAID_BEFORE_LOG_LEAD : undefined;
}

/**
 * The read-only sum line under the field while editing with IRS payments in the log, else undefined.
 * The field is always only what was paid before logging (stored as profile.estimatedPaid, never adjusted);
 * the logged IRS payments stay in the log. Z = field + log, exactly what buildTaxInput sums (LIVE-PP-01).
 */
export function paidSoFarNote(draft: QuizDraft): string | undefined {
  if (!draft.editing || !(draft.loggedIrs > 0)) return undefined;
  const lump = draft.estimatedPaid !== null && Number.isFinite(draft.estimatedPaid) && draft.estimatedPaid > 0 ? draft.estimatedPaid : 0;
  // moneyPay: whole dollars when whole, exact cents otherwise, so X + Y = Z as shown (rounding each part
  // to whole dollars could show 3,701 + 1,001 = 4,701).
  return `Before logging ${moneyPay(lump)} + In your log ${moneyPay(draft.loggedIrs)} = Total paid ${moneyPay(lump + draft.loggedIrs)}`;
}

/**
 * A draft prefilled from a saved profile (and its log), for editing. "Received so far" is prefilled with
 * the true total the engine sees: profile.ytdIncome + every logged income payment.
 */
export function draftFromProfile(p: Profile, log: readonly LogEntry[] = []): QuizDraft {
  const logged = loggedIncomeOf(log);
  const status = (QUIZ_FILING_STATUSES as readonly string[]).includes(p.filingStatus)
    ? (p.filingStatus as QuizFilingStatus)
    : null;
  const priorKnown = p.priorYearTax !== null && p.priorYearAgi !== null;
  const hasW2 = p.w2Wages > 0 || p.w2Withholding > 0;
  return {
    ...emptyDraft(),
    editing: true,
    loggedIncome: logged.total,
    loggedCount: logged.count,
    loggedIrs: loggedIrsOf(log),
    filingStatus: status,
    state: p.state,
    ytdIncome: p.ytdIncome + logged.total,
    expectedIncome: p.expectedIncome,
    hasW2,
    w2Wages: hasW2 ? p.w2Wages : null,
    w2Withholding: hasW2 ? p.w2Withholding : null,
    priorKnown,
    priorYearTax: priorKnown ? p.priorYearTax : null,
    priorYearAgi: priorKnown ? p.priorYearAgi : null,
    // Only what was paid before logging: logged IRS payments stay in the log (shown in the sum line).
    estimatedPaid: p.estimatedPaid,
  };
}

// ---------------------------------------------------------------------------------------------------
// Validation

const isAmount = (v: number | null): v is number => v !== null && Number.isFinite(v) && v >= 0;

/** Per-field messages for one step. An empty object means the step is complete. */
export type StepErrors = Partial<Record<string, string>>;

/**
 * What is missing or wrong on `step`. Missing answers are reported with key "_missing" (the UI keeps
 * Continue disabled and does not shout about empty fields); real conflicts get a field key and a message.
 */
/** The money fields each step asks for (checked for text that isn't an amount). */
const STEP_MONEY_FIELDS: Record<QuizStep, readonly (keyof QuizDraft)[]> = {
  1: [],
  2: [],
  3: ["ytdIncome", "expectedIncome"],
  4: ["w2Wages", "w2Withholding"],
  5: ["priorYearTax", "priorYearAgi"],
  6: ["estimatedPaid"],
};

export const NOT_AN_AMOUNT = "Enter an amount in dollars, like 60,000 or 60,000.50.";

export function stepErrors(draft: QuizDraft, step: QuizStep): StepErrors {
  const e: StepErrors = {};
  // Text that isn't an amount (MoneyInput reports NaN, e.g. "1e5"): say so on the field, block Continue.
  const skip = (step === 4 && !draft.hasW2) || (step === 5 && !draft.priorKnown);
  if (!skip) {
    for (const f of STEP_MONEY_FIELDS[step]) if (Number.isNaN(draft[f])) e[f] = NOT_AN_AMOUNT;
    if (Object.keys(e).length > 0) return e;
  }
  switch (step) {
    case 1:
      if (draft.filingStatus === null) e._missing = "Choose a filing status.";
      break;
    case 2:
      if (draft.state === null || !isStateCode(draft.state)) e._missing = "Choose your state.";
      break;
    case 3:
      if (!isAmount(draft.ytdIncome) || !isAmount(draft.expectedIncome)) e._missing = "Enter both amounts.";
      else if (draft.editing && draft.ytdIncome < draft.loggedIncome)
        e.ytdIncome = `That's less than the ${money(draft.loggedIncome)} you've already logged. Remove payments from your log, or enter at least ${money(draft.loggedIncome)}.`;
      else if (draft.expectedIncome < draft.ytdIncome)
        e.expectedIncome = "The full year can't be less than your profit so far.";
      else if (draft.expectedIncome === 0) e.expectedIncome = "Enter the profit you expect for 2026.";
      break;
    case 4:
      if (!draft.hasW2) break;
      if (!isAmount(draft.w2Wages) || !isAmount(draft.w2Withholding)) e._missing = "Enter both amounts.";
      else if (draft.w2Wages === 0) e.w2Wages = "Enter your W-2 wages, or turn off the W-2 job.";
      else if (draft.w2Withholding > draft.w2Wages) e.w2Withholding = "Withholding can't be more than the wages.";
      break;
    case 5:
      if (!draft.priorKnown) break;
      if (!isAmount(draft.priorYearTax) || !isAmount(draft.priorYearAgi)) e._missing = "Enter both amounts.";
      break;
    case 6:
      if (!isAmount(draft.estimatedPaid)) e._missing = "Enter the total, or choose None yet.";
      break;
  }
  return e;
}

export function isStepValid(draft: QuizDraft, step: QuizStep): boolean {
  return Object.keys(stepErrors(draft, step)).length === 0;
}

/** The first step that is not complete, or null when every step is. */
export function firstIncompleteStep(draft: QuizDraft): QuizStep | null {
  for (let s = 1; s <= QUIZ_STEPS; s++) if (!isStepValid(draft, s as QuizStep)) return s as QuizStep;
  return null;
}

/** The furthest step someone may be on: they can't skip past an unanswered step. */
export function clampStep(draft: QuizDraft, wanted: number): QuizStep {
  const n = Number.isInteger(wanted) ? Math.min(QUIZ_STEPS, Math.max(1, wanted)) : 1;
  const limit = firstIncompleteStep(draft) ?? QUIZ_STEPS;
  return Math.min(n, limit) as QuizStep;
}

// ---------------------------------------------------------------------------------------------------
// Draft → Profile

/**
 * The finished answers as a Profile, or null if any step is incomplete. When editing, "Received so far" is
 * the total including logged payments, so the stored profile.ytdIncome is that total minus `loggedIncome`
 * (default: the draft's; pass the log's current sum at save time), never below 0.
 */
export function draftToProfile(
  draft: QuizDraft,
  now: Date = new Date(),
  loggedIncome: number = draft.loggedIncome,
): Profile | null {
  if (firstIncompleteStep(draft) !== null) return null;
  const entered = draft.ytdIncome as number;
  const known = draft.priorKnown;
  return {
    filingStatus: draft.filingStatus as QuizFilingStatus,
    state: draft.state as StateCode,
    ytdIncome: draft.editing ? Math.max(0, entered - loggedIncome) : entered,
    expectedIncome: draft.expectedIncome as number,
    w2Wages: draft.hasW2 ? (draft.w2Wages as number) : 0,
    w2Withholding: draft.hasW2 ? (draft.w2Withholding as number) : 0,
    priorYearTax: known ? (draft.priorYearTax as number) : null,
    priorYearAgi: known ? (draft.priorYearAgi as number) : null,
    // Always the value entered: the field is only what was paid before logging (LIVE-PP-01).
    estimatedPaid: draft.estimatedPaid as number,
    createdAt: now.toISOString(),
    isExample: false,
  };
}

// ---------------------------------------------------------------------------------------------------
// Engine check

/** Which step owns each engine input field (the part of the TaxInputError field before any "[" or "."). */
const FIELD_STEP: Record<string, QuizStep> = {
  filingStatus: 1,
  state: 2,
  ytd1099Income: 3,
  expectedAnnual1099Income: 3,
  payments1099: 3,
  w2Wages: 4,
  w2Withholding: 4,
  w2WagesOfFreelancer: 4,
  priorYearTax: 5,
  priorYearAgi: 5,
  priorYearFullYear: 5,
  estimatedPaymentsMade: 6,
};

/** The quiz step to show an engine error on (unknown fields, e.g. asOf, land on the last step). */
export function stepForEngineField(field: string): QuizStep {
  const root = field.split(/[.[]/, 1)[0] ?? "";
  return FIELD_STEP[root] ?? QUIZ_STEPS;
}

/** What to tell the person when the engine rejects an answer on a step. */
const ENGINE_MESSAGES: Record<QuizStep, string> = {
  1: "Please choose your filing status again.",
  2: "Please choose your state again.",
  3: "Please check these amounts. Enter dollars, 0 or more.",
  4: "Please check your W-2 amounts. Enter dollars, 0 or more.",
  5: "Please check last year’s amounts, or choose I don’t know.",
  6: "Please check this amount. Enter dollars, 0 or more, or choose None yet.",
};

export interface EngineProblem {
  step: QuizStep;
  message: string;
}

/**
 * Run the engine once on the finished profile (with the log that will be kept), exactly as /plan will.
 * Returns null when it computes, or the step and message to show when it rejects the input.
 */
export function checkWithEngine(profile: Profile, log: readonly LogEntry[], asOf: string): EngineProblem | null {
  try {
    estimate(buildTaxInput(profile, log, asOf));
    return null;
  } catch (err) {
    if (err instanceof TaxInputError) {
      // The engine's text names internal fields; it goes to the console, the person gets a plain message.
      console.error("Penaltyproof quiz: engine rejected the answers", err.message);
      const step = stepForEngineField(err.field);
      return { step, message: ENGINE_MESSAGES[step] };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------------
// Income suggestion

const MS_PER_DAY = 86_400_000;

/** Months of 2026 elapsed by `asOf` (fractional, by day), at least 1 so early-year numbers stay sane; 12 after 2026. */
export function monthsElapsed(asOf: string): number {
  if (asOf >= "2027-01-01") return 12;
  const start = Date.UTC(2026, 0, 1);
  const [y, m, d] = asOf.split("-").map(Number) as [number, number, number];
  const days = (Date.UTC(y, m - 1, d) - start) / MS_PER_DAY + 1; // asOf counts as elapsed
  return Math.min(12, Math.max(1, (days / 365) * 12));
}

/**
 * A placeholder for "Expected freelance profit for all of 2026": the pace so far run out to twelve months
 * (so far × 12 / months elapsed), rounded to the nearest $100. null when there's nothing to project.
 * Never below what was already received.
 */
export function suggestExpectedIncome(ytdIncome: number | null, asOf: string): number | null {
  if (ytdIncome === null || !Number.isFinite(ytdIncome) || ytdIncome <= 0) return null;
  const projected = Math.round((ytdIncome * 12) / monthsElapsed(asOf) / 100) * 100;
  return Math.max(projected, Math.ceil(ytdIncome));
}

// ---------------------------------------------------------------------------------------------------
// Draft parsing (sessionStorage is untrusted)

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

/** A stored draft, validated field by field; null if it isn't a draft at all. */
export function parseDraft(raw: string | null): QuizDraft | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || (v as { v?: unknown }).v !== 1) return null;
  const o = v as Record<string, unknown>;
  const draft: QuizDraft = {
    v: 1,
    step: 1,
    editing: o.editing === true,
    loggedIncome: o.editing === true ? (numOrNull(o.loggedIncome) ?? 0) : 0,
    loggedCount: o.editing === true && Number.isInteger(o.loggedCount) && (o.loggedCount as number) > 0 ? (o.loggedCount as number) : 0,
    loggedIrs: o.editing === true ? (numOrNull(o.loggedIrs) ?? 0) : 0,
    // An older saved draft may still carry `lumpAtOpen` (the removed heuristic); it is ignored.
    filingStatus: (QUIZ_FILING_STATUSES as readonly unknown[]).includes(o.filingStatus)
      ? (o.filingStatus as QuizFilingStatus)
      : null,
    state: isStateCode(o.state) ? o.state : null,
    ytdIncome: numOrNull(o.ytdIncome),
    expectedIncome: numOrNull(o.expectedIncome),
    hasW2: o.hasW2 === true,
    w2Wages: numOrNull(o.w2Wages),
    w2Withholding: numOrNull(o.w2Withholding),
    priorKnown: o.priorKnown !== false,
    priorYearTax: numOrNull(o.priorYearTax),
    priorYearAgi: numOrNull(o.priorYearAgi),
    estimatedPaid: numOrNull(o.estimatedPaid),
  };
  draft.step = clampStep(draft, typeof o.step === "number" ? o.step : 1);
  return draft;
}
