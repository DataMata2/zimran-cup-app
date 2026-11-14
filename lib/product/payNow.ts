// The past-due "pay now" headline: which amounts and words the /plan hero shows when instalments are late.
// Pure selection and copy. Every amount comes from the engine (estimate() and estimateAccruedPenalty()).

import type { PenaltyEstimate, TaxResult } from "@/lib/tax";
import { money } from "./format";

/** Below this weekly penalty (dollars) the hero says the penalty grows daily instead of "about $0 a week". */
export const WEEKLY_PENALTY_MIN = 1;

export interface PayNow {
  /** Pay this now: the cumulative shortfall over the past-due instalments. */
  amount: number;
  /** Past-due quarters, oldest first. */
  quarters: (1 | 2 | 3 | 4)[];
  /** "Q3 is past due." / "Q1 and Q3 are past due." / "Q1–Q3 are past due." */
  pastDueText: string;
  /** Penalty added per week if it stays unpaid; null when under WEEKLY_PENALTY_MIN. */
  weeklyPenalty: number | null;
  /** What is still due at the next deadline after the past-due amount; null when nothing is left (or no deadline). */
  then: { amount: number; due: string } | null;
  /** Penalty accrued so far (estimate). */
  penaltySoFar: number;
}

/**
 * Quarters as a phrase: [3] → "Q3", [1, 3] → "Q1 and Q3", [1, 2] → "Q1 and Q2", [1, 2, 3] → "Q1–Q3",
 * [1, 2, 4] → "Q1, Q2 and Q4". A run of three or more reads as a range.
 */
export function quarterList(quarters: readonly number[]): string {
  const qs = [...new Set(quarters)].sort((a, b) => a - b);
  if (qs.length === 0) return "";
  const first = qs[0]!;
  const last = qs[qs.length - 1]!;
  if (qs.length >= 3 && last - first === qs.length - 1) return `Q${first}–Q${last}`;
  const parts = qs.map((q) => `Q${q}`);
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "Q3 is past due." or "Q1–Q3 are past due." */
export function pastDueSentence(quarters: readonly number[]): string {
  const n = new Set(quarters).size;
  return `${quarterList(quarters)} ${n === 1 ? "is" : "are"} past due.`;
}

/**
 * The pay-now plan when any instalment is past due with a shortfall, else null.
 * amount = the largest cumulative shortfall over the past-due instalments (so missed quarters add up);
 * then = nextDeadline.amountDue − amount, never below 0, hidden when it would show as $0.
 */
export function payNowPlan(result: TaxResult, penalty: PenaltyEstimate): PayNow | null {
  const missed = result.installments.filter((i) => i.status === "pastDue" && i.shortfall > 0);
  if (missed.length === 0) return null;
  const amount = missed.reduce((max, i) => Math.max(max, i.shortfall), 0);
  const quarters = missed.map((i) => i.quarter);
  const next = result.nextDeadline;
  const rest = next ? Math.max(0, next.amountDue - amount) : 0;
  return {
    amount,
    quarters,
    pastDueText: pastDueSentence(quarters),
    weeklyPenalty: penalty.weeklyCostIfUnpaid >= WEEKLY_PENALTY_MIN ? penalty.weeklyCostIfUnpaid : null,
    // Under 50 cents would display as "$0": treat it as nothing left.
    then: next && rest >= 0.5 ? { amount: rest, due: next.due } : null,
    penaltySoFar: penalty.total,
  };
}

/** "about $123", or "less than $1" when it would round to $0. */
export function aboutMoney(amount: number): string {
  return amount < 0.5 ? "less than $1" : `about ${money(amount)}`;
}
