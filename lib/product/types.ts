// Product-level types: what the user told us (Profile) and what they logged since (LogEntry).
// Every tax number is computed from these by the engine in lib/tax; nothing here is a tax figure.

import type { FilingStatus, StateCode } from "@/lib/tax";

/** Quiz answers. Amounts are whole-year 2026 dollars unless noted. */
export interface Profile {
  filingStatus: FilingStatus;
  state: StateCode;
  /** Freelance income received so far in 2026 (as of the quiz). */
  ytdIncome: number;
  /** Freelance income expected for all of 2026. */
  expectedIncome: number;
  /** Household W-2 wages for 2026 (0 if none). */
  w2Wages: number;
  /** Federal income tax withheld from W-2 wages for 2026 (0 if none). */
  w2Withholding: number;
  /** 2025 total tax (Form 1040 line 24); null = unknown. */
  priorYearTax: number | null;
  /** 2025 AGI (Form 1040 line 11); null = unknown. */
  priorYearAgi: number | null;
  /** Total 2026 estimated payments made before the quiz. */
  estimatedPaid: number;
  /** ISO timestamp of when the profile was saved. */
  createdAt: string;
  /** True for the "Try with an example" persona. */
  isExample: boolean;
}

/** "income" = I got paid by a client; "irs" = I paid the IRS an estimated payment. */
export type LogKind = "income" | "irs";

export interface LogEntry {
  id: string;
  kind: LogKind;
  /** Dollars, > 0. */
  amount: number;
  /** Who paid (income) or a free-text note (irs). May be empty. */
  payer: string;
  /** ISO date (YYYY-MM-DD) the money moved. */
  date: string;
  /**
   * Dollars to set aside from this payment, frozen at log time with `setAsideForPayment` on the result
   * computed AFTER the entry is added (the rate /plan then shows), so history doesn't shift. Always 0 for kind "irs".
   */
  setAside: number;
  /** ISO timestamp of when the entry was logged. */
  createdAt: string;
}

/** What a caller passes to `addLogEntry`; the store fills in `id` and `createdAt`. */
export type NewLogEntry = Omit<LogEntry, "id" | "createdAt">;
