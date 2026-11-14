// What to pay and when: the past-due "pay now" part and the next instalment on its own. The hero, the
// deadlines list, the landing preview and the log all read these, so the split is made in one place.
// Pure selection and copy. Every amount comes from the engine (estimate() and estimateAccruedPenalty()).

import type { Installment, PenaltyEstimate, TaxResult } from "@/lib/tax";
import { longDate, money } from "./format";

/** Below this weekly penalty (dollars) the hero says the penalty grows daily instead of "about $0 a week". */
export const WEEKLY_PENALTY_MIN = 1;

/** Amounts under 50 cents display as "$0": treat them as nothing to pay. */
export const MIN_SHOWN = 0.5;

export interface PastDue {
  /** Everything still unpaid through the past-due instalments: the largest cumulative shortfall over them. */
  amount: number;
  /** Past-due quarters, oldest first. */
  quarters: (1 | 2 | 3 | 4)[];
  /** Their due dates, oldest first. */
  dues: string[];
}

export interface PayTarget {
  quarter: 1 | 2 | 3 | 4;
  due: string;
  /** This instalment on its own: the next deadline's amount without any past-due part. */
  amount: number;
  /** This is the engine's next deadline (false when it is $0 and a later quarter has the next amount). */
  isNext: boolean;
}

export interface PayNow {
  /** Pay this now: the cumulative shortfall over the past-due instalments. */
  amount: number;
  /** Past-due quarters, oldest first. */
  quarters: (1 | 2 | 3 | 4)[];
  /** "Q3 is past due." / "Q1 and Q3 are past due." / "Q1–Q3 are past due." */
  pastDueText: string;
  /** Penalty added per week if it stays unpaid; null when under WEEKLY_PENALTY_MIN. */
  weeklyPenalty: number | null;
  /** The next instalment after the past-due amount; null when nothing more is due for the year. */
  then: PayTarget | null;
  /** Penalty accrued so far (estimate). */
  penaltySoFar: number;
}

/**
 * The past-due part of what is owed now, or null when nothing past due is left (or it is under 50 cents).
 * This is the one place that sums missed quarters: shortfalls are cumulative, so the largest one is the total.
 */
export function pastDue(result: TaxResult): PastDue | null {
  const missed = result.installments.filter((i) => i.status === "pastDue" && i.shortfall > 0);
  const amount = missed.reduce((max, i) => Math.max(max, i.shortfall), 0);
  if (amount < MIN_SHOWN) return null;
  return { amount, quarters: missed.map((i) => i.quarter), dues: missed.map((i) => i.due) };
}

/**
 * The next instalment to pay on its own: the next deadline's amount minus the past-due part, or, when that
 * is $0 (already covered), the first later instalment with a planned payment. Null when nothing more is due.
 */
export function payTarget(result: TaxResult): PayTarget | null {
  const next = result.nextDeadline;
  if (!next) return null;
  const own = next.amountDue - (pastDue(result)?.amount ?? 0);
  if (own >= MIN_SHOWN) return { quarter: next.quarter, due: next.due, amount: own, isNext: true };
  const later = result.installments.find((i) => i.quarter > next.quarter && i.plannedPayment >= MIN_SHOWN);
  return later ? { quarter: later.quarter, due: later.due, amount: later.plannedPayment, isNext: false } : null;
}

/**
 * What is still unpaid on one missed instalment by itself: its rise in the cumulative shortfall over the
 * instalment before it. Over the missed rows these add up to pastDue().amount.
 */
export function missedRemaining(result: TaxResult, quarter: 1 | 2 | 3 | 4): number {
  const idx = result.installments.findIndex((i) => i.quarter === quarter);
  const row = result.installments[idx];
  if (!row) return 0;
  const before = idx > 0 ? (result.installments[idx - 1]?.shortfall ?? 0) : 0;
  return Math.max(0, row.shortfall - before);
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
 * What a deadline row shows: the amount and a short note. A past-due part is paid now, so the next
 * deadline's row shows only its own instalment and each missed row shows what is still unpaid on it.
 */
export function installmentRow(result: TaxResult, i: Installment): { amount: number; note: string } {
  const next = result.nextDeadline;
  if (next && next.quarter === i.quarter) {
    const target = payTarget(result);
    const own = target?.isNext ? target.amount : 0;
    return { amount: own, note: own > 0 ? "Pay by this date" : "Already covered" };
  }
  switch (i.status) {
    case "paid":
      return { amount: i.required, note: "Covered" };
    case "pastDue":
      return { amount: missedRemaining(result, i.quarter), note: "Missed, pay now" };
    default:
      return { amount: i.plannedPayment, note: i.plannedPayment > 0 ? "Planned" : "Nothing to pay" };
  }
}

/** "Missed Q3 payment" or "Missed Q1–Q3 payments": the label over the pay-now amount. */
export function missedLabel(quarters: readonly number[]): string {
  const n = new Set(quarters).size;
  return `Missed ${quarterList(quarters)} payment${n === 1 ? "" : "s"}`;
}

/** "Next quarterly payment (Q4)": the label over the next instalment's amount. */
export function nextLabel(quarter: number): string {
  return `Next quarterly payment (Q${quarter})`;
}

/** The pay-now plan when anything is past due, else null. `then` is payTarget(): the next instalment on its own. */
export function payNowPlan(result: TaxResult, penalty: PenaltyEstimate): PayNow | null {
  const due = pastDue(result);
  if (!due) return null;
  return {
    amount: due.amount,
    quarters: due.quarters,
    pastDueText: pastDueSentence(due.quarters),
    weeklyPenalty: penalty.weeklyCostIfUnpaid >= WEEKLY_PENALTY_MIN ? penalty.weeklyCostIfUnpaid : null,
    then: payTarget(result),
    penaltySoFar: penalty.total,
  };
}

/**
 * The "what next" line after an IRS payment is logged. Never says "covered" while a quarter is past due.
 */
export function nextStepText(result: TaxResult): string {
  const due = pastDue(result);
  const target = payTarget(result);
  if (due) {
    const now = `${quarterList(due.quarters)} ${due.quarters.length === 1 ? "is" : "are"} still past due. Pay ${money(due.amount)} now`;
    return target ? `${now}, then ${money(target.amount)} by ${longDate(target.due)}.` : `${now}.`;
  }
  return target ? `Next: ${money(target.amount)} by ${longDate(target.due)}.` : "That covers your safe-harbor amount for 2026.";
}

/** "about $123", or "less than $1" when it would round to $0. */
export function aboutMoney(amount: number): string {
  return amount < 0.5 ? "less than $1" : `about ${money(amount)}`;
}
