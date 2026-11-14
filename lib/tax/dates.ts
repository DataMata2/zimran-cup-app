// Date helpers on ISO calendar dates (YYYY-MM-DD). ISO strings of this form compare correctly as strings.

import { TAX_YEAR } from "./constants/federal2026";
import { TaxInputError } from "./errors";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days since 1970-01-01 (UTC) for an ISO date; throws on malformed or impossible dates. */
export function dayNumber(iso: string, field = "date"): number {
  const m = typeof iso === "string" ? ISO_DATE.exec(iso) : null;
  if (!m) throw new TaxInputError(field, `invalid ISO date "${String(iso)}" (expected YYYY-MM-DD)`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new TaxInputError(field, `impossible calendar date "${iso}"`);
  }
  return t / MS_PER_DAY;
}

export function assertIsoDate(iso: string, field = "date"): void {
  dayNumber(iso, field);
}

export function fromDayNumber(n: number): string {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(dayNumber(iso) + days);
}

export const YEAR_START = `${TAX_YEAR}-01-01`;
export const YEAR_END = `${TAX_YEAR}-12-31`;


/** Days from Jan 1 of the tax year to `iso` (Jan 1 -> 0). */
export function daysSinceYearStart(iso: string): number {
  return dayNumber(iso) - dayNumber(YEAR_START);
}

/** Number of days in the tax year (365 or 366). */
export function daysInTaxYear(): number {
  return dayNumber(YEAR_END) - dayNumber(YEAR_START) + 1;
}

/**
 * Fraction of the tax year elapsed at the END of `iso` (Jan 1 -> 1/365, Dec 31 -> 1).
 * Clamped to [0, 1] for dates outside the tax year.
 */
export function yearFractionElapsed(iso: string): number {
  const elapsed = dayNumber(iso) - dayNumber(YEAR_START) + 1;
  return Math.min(1, Math.max(0, elapsed / daysInTaxYear()));
}

export function inTaxYear(iso: string): boolean {
  return iso >= YEAR_START && iso <= YEAR_END;
}

/** "2026-04-15" -> "20260415" (iCalendar DATE). */
export function toBasicDate(iso: string): string {
  return iso.replaceAll("-", "");
}
