// Accrued underpayment penalty for 2026 estimated tax: an ESTIMATE, a simplified Form 2210 Part III
// penalty worksheet (regular method). All arithmetic is on unrounded dollars; the result is rounded at the end.

import { PENALTY_DAYS_PER_YEAR, RETURN_DUE, UNDERPAYMENT_RATES } from "./constants/federal2026";
import { dayNumber, YEAR_START } from "./dates";
import { TaxInputError } from "./errors";
import { splitEstimatedPayments } from "./income";
import { round2, roundRate, sum } from "./money";
import type { DatedAmount, TaxResult } from "./types";

export interface PenaltyOptions {
  /** Date to measure the penalty to (YYYY-MM-DD). Default: result.asOf. Must be 2026-01-01..2027-04-15. */
  asOf?: string;
}

export interface PenaltyInstallment {
  quarter: 1 | 2 | 3 | 4;
  due: string;
  /** Unpaid part of this instalment on its due date (after withholding and earlier payments). */
  underpayment: number;
  /** Days from the due date to the day it was paid in full, or to asOf if still unpaid; 0 if never short. */
  daysLate: number;
  penalty: number;
}

export interface PenaltyEstimate {
  /** Sum of the per-instalment penalties (rounded once, from the unrounded sum). */
  total: number;
  /** One entry per instalment due before asOf (instalments not yet due cannot carry a penalty). */
  perInstallment: PenaltyInstallment[];
  /** Underpayment rate in force on asOf. */
  ratePerYear: number;
  /** Penalty added per extra day if the past-due balance stays unpaid: balance × ratePerYear / 365. */
  dailyCostIfUnpaid: number;
  /** Penalty added per extra week if the past-due balance stays unpaid: balance × ratePerYear × 7 / 365. */
  weeklyCostIfUnpaid: number;
  asOf: string;
  method: string;
}

const METHOD =
  "estimate: simplified Form 2210 Part III penalty worksheet (regular method). Each instalment's underpayment on " +
  "its due date × IRS underpayment rate (per calendar quarter) × days late / 365. Withholding counts as paid in " +
  "4 equal parts on the due dates; estimated payments are applied in date order to the earliest unpaid instalment " +
  "and reduce the underpayment from their payment date. The penalty stops at 2027-04-15.";

/** Remaining balance (dollars) treated as fully paid: under half a cent (rounding tolerance, not a tax number). */
const PAID_TOLERANCE = 0.005;

function rateOn(iso: string): number {
  const p = UNDERPAYMENT_RATES.find((r) => iso >= r.from && iso <= r.to) ?? UNDERPAYMENT_RATES[UNDERPAYMENT_RATES.length - 1];
  return p ? p.rate : 0;
}

/** balance × rate × days / 365 over the days (fromDay, toDay], split at the quarterly rate boundaries. */
function accrue(balance: number, fromDay: number, toDay: number): number {
  if (balance <= 0 || toDay <= fromDay) return 0;
  let total = 0;
  for (const r of UNDERPAYMENT_RATES) {
    const lo = Math.max(fromDay, dayNumber(r.from) - 1);
    const hi = Math.min(toDay, dayNumber(r.to));
    if (hi > lo) total += (balance * r.rate * (hi - lo)) / PENALTY_DAYS_PER_YEAR;
  }
  return total;
}

/**
 * Estimate the underpayment penalty accrued so far on the 2026 federal instalments of an estimate() result.
 * Uses the result's instalment fields (required, withholdingCredited) and the estimated payments the engine
 * credits (dated 2026-01-01..result.asOf), applied by the engine's earliest-unpaid-first rule.
 */
export function estimateAccruedPenalty(result: TaxResult, opts: PenaltyOptions = {}): PenaltyEstimate {
  const asOf = opts.asOf ?? result.asOf;
  const endDay = dayNumber(asOf, "asOf");
  if (asOf < YEAR_START || asOf > RETURN_DUE) {
    throw new TaxInputError("asOf", `must be between ${YEAR_START} and ${RETURN_DUE}`);
  }

  const inst = result.installments;
  const rem = inst.map((x) => x.required); // unpaid part of each instalment
  const started = inst.map(() => false); // due date reached (penalty can accrue)
  const since = inst.map(() => 0); // day the current balance started accruing
  const underpayment = inst.map(() => 0);
  const paidOffDay: (number | null)[] = inst.map(() => null);
  const penalty = inst.map(() => 0);

  // Credits: withholding deemed paid on each due date, plus the payments the engine credits.
  const payments: DatedAmount[] = splitEstimatedPayments(result.input).credited;
  const credits: { day: number; amount: number }[] = [
    ...inst.map((x) => ({ day: dayNumber(x.due), amount: x.withholdingCredited })),
    ...payments.map((p) => ({ day: dayNumber(p.date), amount: p.amount })),
  ].filter((c) => c.day <= endDay);
  const days = [...new Set([...credits.map((c) => c.day), ...inst.map((x) => dayNumber(x.due))])]
    .filter((d) => d <= endDay)
    .sort((a, b) => a - b);

  for (const day of days) {
    // 1. Book the penalty on past-due balances up to this day, at the balance before today's credits.
    inst.forEach((_, i) => {
      if (started[i]) {
        penalty[i] = (penalty[i] ?? 0) + accrue(rem[i] ?? 0, since[i] ?? day, day);
        since[i] = day;
      }
    });
    // 2. Apply today's credits to the earliest unpaid instalment (due or not yet due).
    for (const c of credits.filter((x) => x.day === day)) {
      let left = c.amount;
      for (let i = 0; i < rem.length && left > 0; i++) {
        const take = Math.min(left, rem[i] ?? 0);
        if (take <= 0) continue;
        // A balance under half a cent is paid: cent amounts leave binary residue such as 1.1e-13.
        rem[i] = (rem[i] ?? 0) - take <= PAID_TOLERANCE ? 0 : (rem[i] ?? 0) - take;
        left -= take;
        if (started[i] && rem[i] === 0) paidOffDay[i] = day;
      }
      // Anything left over pays nothing more off: every instalment is covered.
    }
    // 3. Instalments due today: what is still unpaid is the underpayment; it accrues from today.
    inst.forEach((x, i) => {
      if (!started[i] && dayNumber(x.due) === day) {
        started[i] = true;
        since[i] = day;
        underpayment[i] = rem[i] ?? 0;
      }
    });
  }

  // Book the penalty from the last event to asOf on what is still unpaid.
  inst.forEach((_, i) => {
    if (started[i]) penalty[i] = (penalty[i] ?? 0) + accrue(rem[i] ?? 0, since[i] ?? endDay, endDay);
  });

  const perInstallment: PenaltyInstallment[] = [];
  inst.forEach((x, i) => {
    const dueDay = dayNumber(x.due);
    if (dueDay >= endDay) return;
    const up = underpayment[i] ?? 0;
    const daysLate = up > 0 ? (paidOffDay[i] ?? endDay) - dueDay : 0;
    perInstallment.push({ quarter: x.quarter, due: x.due, underpayment: round2(up), daysLate, penalty: round2(penalty[i] ?? 0) });
  });

  const ratePerYear = rateOn(asOf);
  const pastDueBalance = sum(inst.map((x, i) => (dayNumber(x.due) < endDay ? (rem[i] ?? 0) : 0)));
  return {
    total: round2(sum(penalty)),
    perInstallment,
    ratePerYear: roundRate(ratePerYear),
    dailyCostIfUnpaid: round2((pastDueBalance * ratePerYear) / PENALTY_DAYS_PER_YEAR),
    weeklyCostIfUnpaid: round2((pastDueBalance * ratePerYear * 7) / PENALTY_DAYS_PER_YEAR),
    asOf,
    method: METHOD,
  };
}
