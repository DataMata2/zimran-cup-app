// Instalment schedule (regular method): required instalments, crediting of withholding and payments,
// next deadline, planned payments and progress. All values are unrounded dollars.

import { DEADLINES } from "./constants/federal2026";
import { sum } from "./money";
import type { DatedAmount, InstallmentStatus } from "./types";

export interface RawInstallment {
  quarter: 1 | 2 | 3 | 4;
  due: string;
  required: number;
  withholdingCredited: number;
  paymentsCredited: number;
  cumulativeRequired: number;
  cumulativePaid: number;
  shortfall: number;
  plannedPayment: number;
  status: InstallmentStatus;
}

export interface Schedule {
  installments: RawInstallment[];
  nextDeadline: { quarter: 1 | 2 | 3 | 4; due: string; amountDue: number; includesPastDue: boolean } | null;
  totalPayments: number;
  /** Sum of plannedPayment over the remaining due dates. */
  remainingPlanned: number;
  progress: { paidToDate: number; requiredToDate: number; pct: number; annualRequired: number; annualPaid: number };
}

/**
 * Credit payments to instalments by the Form 2210 rule: each payment (in date order) is applied to the
 * earliest instalment that still has an unpaid required amount, even when paid after that due date (the
 * penalty is then only for the days late). What is left after every instalment is covered stays with the
 * first instalment due on/after the payment date (an overpayment carried forward).
 *
 * Withholding is deemed paid in four equal parts on the four due dates (IRC 6654(g)), and any excess carries
 * forward, so the test is cumulative: shortfall(q) = max(0, cumRequired(q) − cumWithholding(q) − cumPayments(q)).
 */
export function buildSchedule(
  requiredAnnualPayment: number,
  w2Withholding: number,
  payments: readonly DatedAmount[],
  asOf: string,
): Schedule {
  const n = DEADLINES.length;
  const required = requiredAnnualPayment / n;
  const withholding = w2Withholding / n;
  const credited = DEADLINES.map(() => 0);

  // Cumulative unpaid required amount through instalment q, given the payments credited so far.
  const unpaidThrough = (q: number): number => {
    let cumReq = 0;
    let cumPaid = 0;
    for (let i = 0; i <= q; i++) {
      cumReq += required;
      cumPaid += withholding + (credited[i] ?? 0);
    }
    return Math.max(0, cumReq - cumPaid);
  };

  for (const p of payments) {
    let left = p.amount;
    for (let q = 0; q < n && left > 0; q++) {
      // Earlier instalments are already covered here, so this is exactly what instalment q still needs.
      const take = Math.min(left, unpaidThrough(q));
      credited[q] = (credited[q] ?? 0) + take;
      left -= take;
    }
    if (left > 0) {
      const idx = DEADLINES.findIndex((d) => d.due >= p.date);
      const q = idx === -1 ? n - 1 : idx;
      credited[q] = (credited[q] ?? 0) + left;
    }
  }

  const totalPayments = sum(payments.map((p) => p.amount));
  const nextIdx = DEADLINES.findIndex((d) => d.due >= asOf);

  let cumReq = 0;
  let cumPaid = 0;
  let cumWithholding = 0;
  let planned = 0;
  const installments: RawInstallment[] = DEADLINES.map((d, i) => {
    cumReq += required;
    cumWithholding += withholding;
    cumPaid += withholding + (credited[i] ?? 0);
    const shortfall = Math.max(0, cumReq - cumPaid);
    // Plan: at each remaining due date pay what keeps the cumulative test at 0, counting every payment made.
    let plannedPayment = 0;
    if (nextIdx !== -1 && i >= nextIdx) {
      plannedPayment = Math.max(0, cumReq - cumWithholding - totalPayments - planned);
      planned += plannedPayment;
    }
    const status: InstallmentStatus =
      shortfall <= 0 ? "paid" : d.due < asOf ? "pastDue" : i === nextIdx ? "due" : "upcoming";
    return {
      quarter: d.quarter,
      due: d.due,
      required,
      withholdingCredited: withholding,
      paymentsCredited: credited[i] ?? 0,
      cumulativeRequired: cumReq,
      cumulativePaid: cumPaid,
      shortfall,
      plannedPayment,
      status,
    };
  });

  const next = nextIdx === -1 ? null : installments[nextIdx];
  const nextDeadline = next
    ? {
        quarter: next.quarter,
        due: next.due,
        // Cumulative required through this deadline − withholding credited through it − every payment made.
        amountDue: Math.max(0, next.cumulativeRequired - withholding * (nextIdx + 1) - totalPayments),
        includesPastDue: installments.some((x) => x.status === "pastDue"),
      }
    : null;

  const throughIdx = nextIdx === -1 ? n - 1 : nextIdx;
  const requiredToDate = required * (throughIdx + 1);
  const paidToDate = withholding * (throughIdx + 1) + totalPayments;
  const withheldSoFar = withholding * DEADLINES.filter((d) => d.due <= asOf).length;

  return {
    installments,
    nextDeadline,
    totalPayments,
    remainingPlanned: planned,
    progress: {
      paidToDate,
      requiredToDate,
      pct: requiredToDate > 0 ? Math.min(100, (paidToDate / requiredToDate) * 100) : 100,
      annualRequired: requiredAnnualPayment,
      annualPaid: totalPayments + withheldSoFar,
    },
  };
}
