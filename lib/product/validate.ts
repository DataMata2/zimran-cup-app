// Shape checks for product data that arrives from outside the code: localStorage (stale, edited, or from
// another version) and request bodies on the AI routes. The engine still validates the tax fields.

import type { FilingStatus } from "@/lib/tax";
import { ASOF_MAX, ASOF_MIN } from "./asof";
import { latestLogDate, LOG_YEAR_START } from "./plan";
import { isStateCode } from "./states";
import type { LogEntry, Profile } from "./types";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const FILING_STATUSES: readonly string[] = ["single", "mfj", "mfs", "hoh", "qss"] satisfies FilingStatus[];
const isFilingStatus = (v: unknown): v is FilingStatus => typeof v === "string" && FILING_STATUSES.includes(v);

export function isProfile(v: unknown): v is Profile {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isFilingStatus(p.filingStatus) && isStateCode(p.state) && isNum(p.ytdIncome) && isNum(p.expectedIncome) &&
    isNum(p.w2Wages) && isNum(p.w2Withholding) && isNumOrNull(p.priorYearTax) && isNumOrNull(p.priorYearAgi) &&
    isNum(p.estimatedPaid) && isStr(p.createdAt) && typeof p.isExample === "boolean"
  );
}

export function isLogEntry(v: unknown): v is LogEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    isStr(e.id) && (e.kind === "income" || e.kind === "irs") && isNum(e.amount) && isStr(e.payer) &&
    isStr(e.date) && isNum(e.setAside) && isStr(e.createdAt)
  );
}

// ---------------------------------------------------------------------------------------------------
// SH-06: meaning checks for a plan backup the server is asked to SAVE (PUT /api/plan-data). Writes only: the
// read paths (GET, restore, localStorage) keep the shape checks above, so a copy stored before these rules
// still loads. Every bound is taken from what the client itself can create, so a real save never fails.

/**
 * Largest money value the client can produce, exclusive: MoneyInput caps the whole-dollar part at 9 digits
 * (components/kit/moneyText.ts MAX_INT_DIGITS, so at most 999,999,999.99) and an AI-read payout is < 100,000,000
 * (ai-prompts.ts normalizeReadPayment).
 */
export const SAVE_MONEY_MAX = 1_000_000_000;
/** The payment log form keeps 60 characters (PaymentLog.tsx PAYER_MAX); the extra is room for older versions. */
export const SAVE_PAYER_MAX = 200;
/** Ids are crypto.randomUUID() (36 characters) or the store's short fallback. */
export const SAVE_ID_MAX = 100;
/** createdAt is Date#toISOString() (24 characters). */
const SAVE_TIMESTAMP_MAX = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

const isMoney = (v: number) => v >= 0 && v < SAVE_MONEY_MAX;

/** A real calendar date written as YYYY-MM-DD ("2026-02-30" is not one). */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isTimestamp = (s: string) => s.length <= SAVE_TIMESTAMP_MAX && !Number.isNaN(new Date(s).getTime());

/**
 * The latest "today" any client can have when the server's clock reads `now`, clamped like asof.ts todayIso.
 * The client uses its LOCAL date and the server can't see the time zone, so this allows +1 day of slack over
 * the server's UTC date (the furthest-ahead zone, UTC+14, is less than a day ahead of UTC).
 */
export function latestClientToday(now: Date): string {
  const iso = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);
  if (iso < ASOF_MIN) return ASOF_MIN;
  if (iso > ASOF_MAX) return ASOF_MAX;
  return iso;
}

/** Why a (shape-checked) profile can't be saved, or null. Bounds match what the quiz accepts (quiz.ts isAmount). */
export function profileSaveError(p: Profile): string | null {
  const money = [p.ytdIncome, p.expectedIncome, p.w2Wages, p.w2Withholding, p.estimatedPaid];
  if (!money.every(isMoney)) return "Profile has an amount out of range.";
  if ((p.priorYearTax !== null && !isMoney(p.priorYearTax)) || (p.priorYearAgi !== null && !isMoney(p.priorYearAgi))) {
    return "Profile has an amount out of range.";
  }
  if (!isTimestamp(p.createdAt)) return "Profile has a malformed date.";
  return null;
}

/**
 * Why a (shape-checked) log entry can't be saved, or null. Same rules as the log form (PaymentLog.tsx submit and
 * plan.ts logDateError): amount > 0, date from Jan 1, 2026 through the client's today (income: also ≤ Dec 31, 2026).
 */
export function logEntrySaveError(e: LogEntry, now: Date): string | null {
  if (e.id.length === 0 || e.id.length > SAVE_ID_MAX) return "Log entry has a malformed id.";
  if (!(e.amount > 0)) return "Log entry amount must be more than 0.";
  if (e.amount >= SAVE_MONEY_MAX) return "Log entry amount is out of range.";
  if (!isMoney(e.setAside)) return "Log entry set-aside is out of range.";
  if (e.payer.length > SAVE_PAYER_MAX) return "Log entry payer is too long.";
  if (!isTimestamp(e.createdAt)) return "Log entry has a malformed date.";
  if (!isIsoDate(e.date)) return "Log entry has a malformed date.";
  const latest = latestLogDate(e.kind, latestClientToday(now));
  if (e.date < LOG_YEAR_START || e.date > latest) return "Log entry date is out of range.";
  return null;
}
