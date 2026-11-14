// Pure helpers behind the /plan screen: run the engine safely, and pick what the screen shows from its result.
// Nothing here computes tax; every amount is read from the engine's TaxResult.

import { estimate, setAsideForPayment, TaxInputError, type Flag, type FlagCode, type TaxInput, type TaxResult } from "@/lib/tax";
import { longDate } from "./format";
import { buildTaxInput } from "./input";
import type { LogEntry, Profile } from "./types";

/** Free tier: this many "I got paid" entries (IRS payments are not counted). The next one needs Pro. */
export const FREE_LOG_LIMIT = 3;

/** True when adding one more entry needs Pro. `used` = "I got paid" entries ever added (see ./freeLimit), not the log length. */
export function needsPro(used: number, pro: boolean): boolean {
  return !pro && used >= FREE_LOG_LIMIT;
}

/** First and last date a new log entry may carry: tax year 2026 only (LIVE-PP-02). */
export const LOG_YEAR_START = "2026-01-01";
export const LOG_YEAR_END = "2026-12-31";

/**
 * Latest date a new log entry (either kind) may carry: today (asOf), and never after Dec 31, 2026.
 * No future dates. A Jan 2027 Q4 payment can't be logged yet (controller ruling: 2026 dates only).
 */
export function latestLogDate(asOf: string): string {
  return asOf > LOG_YEAR_END ? LOG_YEAR_END : asOf;
}

/** The date an "I paid the IRS" entry starts with: today, within 2026. */
export function defaultIrsDate(asOf: string): string {
  return latestLogDate(asOf);
}

/** The inline error for a log entry's date, or null when it is from Jan 1, 2026 through `latestLogDate(asOf)`. */
export function logDateError(date: string, asOf: string): string | null {
  const latest = latestLogDate(asOf);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < LOG_YEAR_START || date > latest) {
    return `Use a date between ${longDate(LOG_YEAR_START)} and ${longDate(latest)}.`;
  }
  return null;
}

export type PlanOutcome =
  | { ok: true; input: TaxInput; result: TaxResult }
  | { ok: false; error: TaxInputError };

/**
 * The engine's plan for this profile and log as of `asOf`. A stale or edited profile that the engine
 * rejects comes back as `{ ok: false }` instead of throwing, so the page can offer to re-enter it.
 */
export function computePlan(profile: Profile, log: readonly LogEntry[], asOf: string): PlanOutcome {
  try {
    const input = buildTaxInput(profile, log, asOf);
    return { ok: true, input, result: estimate(input) };
  } catch (err) {
    if (err instanceof TaxInputError) return { ok: false, error: err };
    throw err;
  }
}

/**
 * The set-aside for a client payment being logged (PP-QA-01): `setAsideForPayment` on the plan AFTER the
 * payment is added, i.e. buildTaxInput with the new log, so the confirmation shows the same rate the plan
 * shows right after. Stored on the entry, so existing entries keep their own setAside. If the engine rejects
 * the new log (it shouldn't: income only raises the totals), `before` is used instead.
 */
export function setAsideAfterLogging(
  profile: Profile,
  log: readonly LogEntry[],
  payment: { amount: number; date: string },
  asOf: string,
  before: TaxResult,
): { setAside: number; rate: number } {
  const pending: LogEntry = {
    id: "pending",
    kind: "income",
    amount: payment.amount,
    payer: "",
    date: payment.date,
    setAside: 0,
    createdAt: "",
  };
  const after = computePlan(profile, [...log, pending], asOf);
  const { setAside, rate } = setAsideForPayment(after.ok ? after.result : before, payment.amount);
  return { setAside, rate };
}

/** Flags shown elsewhere on the screen (the hero already explains a past-due amount). */
const SHOWN_ELSEWHERE: readonly FlagCode[] = ["past_due_installment"];
/** Flags that read as fine print, under the breakdown. */
const FOOTNOTE: readonly FlagCode[] = ["credits_not_modeled"];

/** The engine's flags split into notes and footnotes, one per code, in the engine's order. */
export function planNotes(flags: readonly Flag[]): { notes: Flag[]; footnotes: Flag[] } {
  const seen = new Set<FlagCode>();
  const notes: Flag[] = [];
  const footnotes: Flag[] = [];
  for (const f of flags) {
    if (seen.has(f.code) || SHOWN_ELSEWHERE.includes(f.code)) continue;
    seen.add(f.code);
    (FOOTNOTE.includes(f.code) ? footnotes : notes).push(f);
  }
  return { notes, footnotes };
}
