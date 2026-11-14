// The payment meter: how much of the legal minimum due so far has actually been paid to the IRS.
// Only IRS payments (and W-2 withholding) protect against the underpayment penalty, so only they fill the
// bar. Money the user set aside from logged payments is shown on its own line: it is not paid yet.

import type { TaxResult } from "@/lib/tax";
import { longDate, money } from "./format";
import type { LogEntry } from "./types";

export interface PenaltyMeter {
  /** Paid to the IRS through the deadline below: withholding deemed paid + estimated payments (engine). */
  paid: number;
  /** The legal minimum due through that deadline (engine's progress.requiredToDate). */
  required: number;
  /** min(100, paid / required × 100), unrounded; null when nothing was due yet (required is 0). */
  pct: number | null;
  /** The deadline `required` runs through: the next deadline, or Q4 once no 2026 deadline is left. */
  through: { quarter: 1 | 2 | 3 | 4; due: string };
  /**
   * Money still held in the set-aside pot: Σ setAside of income entries minus Σ logged IRS payments
   * (those are paid out of the pot, and already count in `paid`), never negative. Not paid to the IRS.
   */
  setAside: number;
  /** The safe-harbor required annual payment for the whole year. */
  target: number;
}

export function penaltyMeter(result: TaxResult, log: readonly LogEntry[]): PenaltyMeter {
  const { paidToDate: paid, requiredToDate: required } = result.progress;
  let saved = 0;
  let paidFromPot = 0;
  for (const e of log) {
    if (e.kind === "income") saved += e.setAside;
    else paidFromPot += e.amount;
  }
  const last = result.installments[result.installments.length - 1]!;
  const through = result.nextDeadline ?? last;
  return {
    paid,
    required,
    pct: required > 0 ? Math.min(100, (paid / required) * 100) : null,
    through: { quarter: through.quarter, due: through.due },
    setAside: Math.max(0, round2(saved - paidFromPot)),
    target: result.safeHarbor.requiredAnnualPayment,
  };
}

/** Width of the bar in percent: only IRS payments fill it. Full when nothing was due. */
export function meterFill(m: PenaltyMeter): number {
  return m.pct ?? 100;
}

/**
 * Whole percent for display, rounded down so the meter never claims 100% before the minimum is met.
 * Null when nothing was due yet.
 */
export function meterPctLabel(m: PenaltyMeter): number | null {
  return m.pct === null ? null : Math.floor(m.pct + 1e-9);
}

/**
 * One tick per instalment the minimum covers (equal quarters), so the bar reads Q1 … Q<through>.
 * Through Q4 that is 25 / 50 / 75 / 100; through Q2 it is 50 / 100.
 */
export function meterTicks(m: PenaltyMeter): { ticks: number[]; labels: string[] } {
  const n = m.through.quarter;
  const qs = Array.from({ length: n }, (_, i) => i + 1);
  return { ticks: qs.map((q) => (q / n) * 100), labels: qs.map((q) => `Q${q}`) };
}

/** "$3,700 of the $7,400 minimum due by Jan 15, 2027", or "Nothing was due yet". */
export function meterSummary(m: PenaltyMeter): string {
  if (m.pct === null) return "Nothing was due yet";
  return `${money(m.paid)} of the ${money(m.required)} minimum due by ${longDate(m.through.due)}`;
}

/** Spoken value of the bar: "Paid to the IRS: $3,700 of the $7,400 minimum due by Jan 15, 2027 (50%)". */
export function meterValueText(m: PenaltyMeter): string {
  const pct = meterPctLabel(m);
  return `Paid to the IRS: ${meterSummary(m)}${pct === null ? "" : ` (${pct}%)`}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
