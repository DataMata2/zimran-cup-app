// What to pay and when: the past-due "pay now" part and the next instalment on its own. The hero, the
// deadlines list, the landing preview and the log all read these, so the split is made in one place.
// Pure selection and copy. Every amount comes from the engine (estimate() and estimateAccruedPenalty()).

import type { Installment, PenaltyEstimate, TaxResult } from "@/lib/tax";
import { SET_ASIDE_MAX_RATE } from "@/lib/tax/estimate";
import { longDate, money, pct } from "./format";

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

/**
 * What to do with money just set aside from a client payment. With a quarter past due it goes toward the
 * missed amount now, not to the next deadline.
 */
export function setAsideNextStep(result: TaxResult): string {
  const due = pastDue(result);
  if (due) {
    const missed = due.quarters.length === 1 ? `missed ${quarterList(due.quarters)} payment` : `missed ${quarterList(due.quarters)} payments`;
    return `Pay it toward your ${missed} now with IRS Direct Pay.`;
  }
  return result.nextDeadline
    ? `Move it to savings now, then pay it to the IRS by ${longDate(result.nextDeadline.due)}.`
    : "Move it to savings now, and keep it for your April 15, 2027 return.";
}

/** "about $123", or "less than $1" when it would round to $0. */
export function aboutMoney(amount: number): string {
  return amount < 0.5 ? "less than $1" : `about ${money(amount)}`;
}

/**
 * Penalty that already built up from quarters paid late, when nothing is past due any more. Null when a
 * quarter is still past due (the pay-now headline shows the penalty then) or when it is under 50 cents.
 * While this is set, the hero and the AI facts never say "penalty-proof" or "no penalty applies".
 */
export function latePaidPenalty(result: TaxResult, penalty: PenaltyEstimate): number | null {
  if (pastDue(result)) return null;
  return penalty.total >= MIN_SHOWN ? penalty.total : null;
}

/** The calm line under the hero when latePaidPenalty() is set. */
export function latePaidText(amount: number): string {
  return `Paid late earlier this year: ${aboutMoney(amount)} in penalty has built up (estimate). The IRS bills it after you file; it stopped growing once each quarter was paid.`;
}

/** The end of the pay-target headline after "Pay $X by <date>". */
export function payTargetPurpose(latePenalty: number | null): string {
  return latePenalty === null ? "to stay penalty-proof." : "to keep the penalty from growing.";
}

/** The headline and the line under it once nothing more is due for the year. */
export function allPaidCopy(latePenalty: number | null): { headline: string; body: string } {
  return latePenalty === null
    ? {
        headline: "You’re penalty-proof for 2026.",
        body: "What you’ve paid meets the safe-harbor amount, so no underpayment penalty applies. Keep setting money aside for the balance with your return.",
      }
    : {
        headline: "You’re paid up for 2026.",
        body: "What you’ve paid meets the safe-harbor amount, so no more penalty builds up. Keep setting money aside for the balance with your return.",
      };
}

/**
 * The "catching up" line under the set-aside rate, or null when it would say the same as the rate.
 * At the engine's cap the catch-up rate is a ceiling, not a real share, so the line says the cap won't cover it.
 */
export function catchUpLine(result: TaxResult): { text: string; capped: boolean } | null {
  const { rate, catchUpRate } = result.setAside;
  if (!(catchUpRate > rate + 0.0005)) return null;
  // The engine's catch-up rate assumes nothing was set aside from the income so far: say so, with the amount.
  const earned = result.income.net1099Ytd;
  const ask =
    earned >= MIN_SHOWN
      ? `Haven’t set anything aside from the ${money(earned)} you’ve earned so far?`
      : "Haven’t set anything aside yet?";
  if (catchUpRate >= SET_ASIDE_MAX_RATE - 1e-9) {
    const text = `${ask} Even ${pct(SET_ASIDE_MAX_RATE, 0)} of what’s still to come won’t cover it, so plan for a balance with your April return.`;
    return { text, capped: true };
  }
  return { text: `${ask} Then set aside ${pct(catchUpRate, 0)} of what’s still to come instead.`, capped: false };
}
