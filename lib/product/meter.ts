// The penalty-proof meter: how much of the safe-harbor target is already covered, counting both money
// paid to the IRS and money the user set aside from logged payments.

import type { TaxResult } from "@/lib/tax";
import type { LogEntry } from "./types";

export interface PenaltyMeter {
  /** Paid to the IRS so far (estimated payments + withholding to date), from the engine. */
  paid: number;
  /** Sum of `setAside` over logged income entries. */
  setAside: number;
  /** The safe-harbor required annual payment. */
  target: number;
  /** min(100, (paid + setAside) / target × 100); 100 when nothing is required. Unrounded. */
  pct: number;
  /** Quarter of the next deadline, or null when no 2026 deadline is left. */
  quarter: 1 | 2 | 3 | 4 | null;
}

export function penaltyMeter(result: TaxResult, log: readonly LogEntry[]): PenaltyMeter {
  const paid = result.progress.annualPaid;
  const setAside = round2(
    log.reduce((sum, e) => (e.kind === "income" ? sum + e.setAside : sum), 0),
  );
  const target = result.safeHarbor.requiredAnnualPayment;
  const pct = target > 0 ? Math.min(100, ((paid + setAside) / target) * 100) : 100;
  return { paid, setAside, target, pct, quarter: result.nextDeadline?.quarter ?? null };
}

/**
 * Widths of the two bar segments in percent of the target. They never sum past 100: paid fills first,
 * set-aside takes what is left.
 */
export function meterSegments(m: PenaltyMeter): { paidPct: number; setAsidePct: number } {
  if (m.target <= 0) return { paidPct: 100, setAsidePct: 0 };
  const paidPct = Math.min(100, (m.paid / m.target) * 100);
  const setAsidePct = Math.min(100 - paidPct, (m.setAside / m.target) * 100);
  return { paidPct, setAsidePct };
}

/**
 * Whole percent for display, rounded down so the meter never claims 100% before the target is met.
 */
export function meterPctLabel(m: PenaltyMeter): number {
  return Math.floor(m.pct + 1e-9);
}

/** "Q4: 63% penalty-proof", or "63% penalty-proof" when no deadline is left. */
export function meterLabel(m: PenaltyMeter): string {
  const body = `${meterPctLabel(m)}% penalty-proof`;
  return m.quarter ? `Q${m.quarter}: ${body}` : body;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
