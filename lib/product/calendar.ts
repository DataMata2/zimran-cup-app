// The calendar file for /plan, built in the browser from the engine result (toICS), so income figures
// never leave the page in a URL. It matches the hero: a missed amount is a "pay now" event for tomorrow
// morning, and the next deadline carries only its own instalment (both amounts from lib/product/payNow).

import { toICS, type TaxResult } from "@/lib/tax";
import { TAX_YEAR } from "@/lib/tax/constants/federal2026";
import { addDays, daysSinceYearStart, toBasicDate } from "@/lib/tax/dates";
import { foldLine } from "@/lib/tax/ics";
import { dateList, money } from "./format";
import { pastDue, payTarget, quarterList, type PastDue } from "./payNow";

export const ICS_FILENAME = "penaltyproof-2026.ics";
export const ICS_TYPE = "text/calendar;charset=utf-8";

const CRLF = "\r\n";
const DIRECT_PAY_URL = "https://www.irs.gov/payments/direct-pay";
/** Local (floating) time of the pay-now event on the day after asOf. */
const PAY_NOW_START = "T090000";
const PAY_NOW_END = "T093000";

/** RFC 5545 section 3.3.11 TEXT escaping (the same rules as the engine's toICS). */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * Dollars in the .ics file, in the engine's toICS format ("$1250.00": cents, no thousands separator) so every
 * event in the file reads the same. The engine's formatter isn't exported; this mirrors lib/tax/ics.ts `dollars`.
 */
export function icsDollars(x: number): string {
  return `$${x.toFixed(2)}`;
}

/** "Pay missed Q3 estimated tax: $1850.00": the pay-now event title, worded like the hero. */
export function payNowSummary(due: PastDue): string {
  return `Pay missed ${quarterList(due.quarters)} estimated tax: ${icsDollars(due.amount)}`;
}

/** The pay-now VEVENT: tomorrow 09:00–09:30 local time, with a reminder when it starts. */
function payNowEvent(result: TaxResult, due: PastDue): string[] {
  const day = toBasicDate(addDays(result.asOf, 1));
  const quarters = quarterList(due.quarters);
  const summary = payNowSummary(due);
  const description =
    `Federal estimated tax (Form 1040-ES) for ${quarters} ${TAX_YEAR} ${due.quarters.length > 1 ? "were" : "was"} due ${dateList(due.dues)} ` +
    `and is still unpaid: ${icsDollars(due.amount)}. The IRS penalty grows every day it stays unpaid. ` +
    `Pay with IRS Direct Pay: ${DIRECT_PAY_URL} (choose "Estimated Tax" and tax year ${TAX_YEAR}). ` +
    `Amounts are estimates from Penaltyproof as of ${result.asOf}; reopen the app to refresh them.`;
  return [
    "BEGIN:VEVENT",
    `UID:penaltyproof-${TAX_YEAR}-pastdue@penaltyproof`,
    `DTSTAMP:${toBasicDate(result.asOf)}T000000Z`,
    `SEQUENCE:${Math.max(0, daysSinceYearStart(result.asOf))}`,
    `DTSTART:${day}${PAY_NOW_START}`,
    `DTEND:${day}${PAY_NOW_END}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${DIRECT_PAY_URL}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0S",
    `DESCRIPTION:${escapeText(summary)}`,
    "END:VALARM",
    "END:VEVENT",
  ];
}

/**
 * Each remaining deadline with its amount and a reminder, plus the April 15, 2027 return. With nothing past
 * due this is exactly toICS(result, { includeReturnDue: true }). With a past-due amount it adds a "pay now"
 * event for tomorrow and gives the next deadline its own instalment (payTarget) instead of the lump.
 */
export function calendarFile(result: TaxResult): string {
  const due = pastDue(result);
  if (!due) return toICS(result, { includeReturnDue: true });

  // The engine writes the deadline events; it is handed the next deadline at the hero's own amount.
  const next = result.nextDeadline;
  const target = payTarget(result);
  const own: TaxResult = next
    ? { ...result, nextDeadline: { ...next, amountDue: target?.isNext ? target.amount : 0, includesPastDue: false } }
    : result;
  const ics = toICS(own, { includeReturnDue: true });

  const event = payNowEvent(result, due).map(foldLine).join(CRLF) + CRLF;
  const at = ics.indexOf("BEGIN:VEVENT");
  const insertAt = at >= 0 ? at : ics.lastIndexOf("END:VCALENDAR");
  return ics.slice(0, insertAt) + event + ics.slice(insertAt);
}

/** The line next to "Add all to calendar": what the file holds for this result. */
export function calendarNote(result: TaxResult): string {
  const due = pastDue(result);
  return due
    ? `A reminder tomorrow at 9 AM to pay the missed ${quarterList(due.quarters)} amount (${money(due.amount)}), then each remaining deadline with its own amount and a reminder 3 days before.`
    : "Each remaining deadline with its amount, plus a reminder 3 days before.";
}
