// Pure helpers behind the /plan screen: run the engine safely, and pick what the screen shows from its result.
// Nothing here computes tax; every amount is read from the engine's TaxResult.

import { estimate, TaxInputError, type Flag, type FlagCode, type TaxInput, type TaxResult } from "@/lib/tax";
import { buildTaxInput } from "./input";
import type { LogEntry, Profile } from "./types";

/** Free tier: this many logged entries (income + IRS payments together). The next one needs Pro. */
export const FREE_LOG_LIMIT = 3;

/** True when adding one more entry needs Pro. `used` = entries ever added (see ./freeLimit), not the log length. */
export function needsPro(used: number, pro: boolean): boolean {
  return !pro && used >= FREE_LOG_LIMIT;
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

export interface PastDue {
  /** Everything still unpaid through the last missed due date (the cumulative shortfall). */
  amount: number;
  /** Due dates of the missed instalments, oldest first. */
  dues: string[];
}

/**
 * The overdue part of the next deadline: the largest cumulative shortfall over the past-due instalments
 * (so two missed quarters add up), with the dates that were missed. Null when nothing is past due.
 */
export function pastDuePart(result: TaxResult): PastDue | null {
  if (!result.nextDeadline?.includesPastDue) return null;
  const missed = result.installments.filter((i) => i.status === "pastDue");
  const amount = missed.reduce((max, i) => Math.max(max, i.shortfall), 0);
  if (missed.length === 0 || amount <= 0) return null;
  return { amount, dues: missed.map((i) => i.due) };
}

export interface PayTarget {
  quarter: 1 | 2 | 3 | 4;
  due: string;
  amount: number;
  /** This is the engine's next deadline (false when it is $0 and a later quarter has the next amount). */
  isNext: boolean;
}

/**
 * The next payment the hero asks for: the next deadline's amount, or, when that is $0 (already covered),
 * the first later instalment with a planned payment. Null when nothing more is due for the tax year.
 */
export function payTarget(result: TaxResult): PayTarget | null {
  const next = result.nextDeadline;
  if (!next) return null;
  if (next.amountDue > 0) return { quarter: next.quarter, due: next.due, amount: next.amountDue, isNext: true };
  const later = result.installments.find((i) => i.quarter > next.quarter && i.plannedPayment > 0);
  return later ? { quarter: later.quarter, due: later.due, amount: later.plannedPayment, isNext: false } : null;
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
