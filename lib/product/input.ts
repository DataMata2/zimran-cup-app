// Profile + log → engine input. The only place product data is translated into a TaxInput.

import type { DatedAmount, TaxInput } from "@/lib/tax";
import type { LogEntry, Profile } from "./types";

/** Latest date the quiz's lump-sum "estimated payments so far" is assumed to have been paid (Q3 due date). */
const LUMP_LATEST = "2026-09-15";
const LUMP_EARLIEST = "2026-01-01";

/**
 * Build the engine input for `asOf` (YYYY-MM-DD, already clamped — see `todayIso`).
 *
 * - ytd1099Income = profile.ytdIncome + every income entry.
 * - expectedAnnual1099Income = max(profile.expectedIncome, that YTD).
 * - estimatedPaymentsMade = the quiz lump sum (dated asOf, but no earlier than Jan 1 and no later than
 *   Sep 15, 2026) plus every "irs" entry on its own date.
 * - W-2 and prior-year fields pass through (null prior-year tax = unknown).
 */
export function buildTaxInput(profile: Profile, log: readonly LogEntry[], asOf: string): TaxInput {
  let loggedIncome = 0;
  const payments: DatedAmount[] = [];

  if (profile.estimatedPaid > 0) {
    const date = maxIso(LUMP_EARLIEST, minIso(asOf, LUMP_LATEST));
    payments.push({ date, amount: profile.estimatedPaid });
  }
  for (const entry of log) {
    if (entry.kind === "income") loggedIncome += entry.amount;
    else payments.push({ date: entry.date, amount: entry.amount });
  }

  const ytd = profile.ytdIncome + loggedIncome;
  return {
    filingStatus: profile.filingStatus,
    state: profile.state,
    asOf,
    ytd1099Income: ytd,
    expectedAnnual1099Income: Math.max(profile.expectedIncome, ytd),
    w2Wages: profile.w2Wages,
    w2Withholding: profile.w2Withholding,
    priorYearTax: profile.priorYearTax,
    priorYearAgi: profile.priorYearAgi,
    estimatedPaymentsMade: payments,
  };
}

const minIso = (a: string, b: string) => (a < b ? a : b);
const maxIso = (a: string, b: string) => (a > b ? a : b);
