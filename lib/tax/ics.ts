// toICS(): RFC 5545 calendar with one all-day event per remaining federal estimated-tax deadline.

import { RETURN_DUE, TAX_YEAR } from "./constants/federal2026";
import { addDays, daysSinceYearStart, toBasicDate } from "./dates";
import type { TaxResult } from "./types";

const CRLF = "\r\n";
const MAX_OCTETS = 75; // RFC 5545 section 3.1: lines SHOULD NOT be longer than 75 octets, excluding CRLF
const DIRECT_PAY_URL = "https://www.irs.gov/payments/direct-pay";

/** UTF-8 length in octets of a string (no TextEncoder, so the module needs no DOM or Node typings). */
function octets(s: string): number {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    n += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
  }
  return n;
}

/** RFC 5545 section 3.3.11 TEXT escaping. */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets; continuation lines start with one space. Never splits a UTF-8 character. */
export function foldLine(line: string): string {
  if (octets(line) <= MAX_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let used = 0;
  let limit = MAX_OCTETS;
  for (const ch of line) {
    const n = octets(ch);
    if (used + n > limit) {
      parts.push(current);
      current = "";
      used = 0;
      limit = MAX_OCTETS - 1; // the leading space counts toward the 75 octets
    }
    current += ch;
    used += n;
  }
  parts.push(current);
  return parts.join(CRLF + " ");
}

/** Dollars with cents and no thousands separator (a comma would need escaping in TEXT values). */
function dollars(x: number): string {
  return `$${x.toFixed(2)}`;
}

export interface IcsOptions {
  /**
   * Add an event for the return due date (April 15 of the next year) with the expected balance.
   * Default: only when no instalment event remains, so the calendar is never empty (RFC 5545 §3.6 needs one
   * component). Pass true to always add it.
   */
  includeReturnDue?: boolean;
}

interface CalendarEvent {
  uid: string;
  date: string;
  summary: string;
  description: string;
  alarm: string;
}

/**
 * RFC 5545 calendar: one all-day event per remaining instalment that has something to pay ($0 instalments are
 * skipped), plus the return due date (see IcsOptions). SEQUENCE = days from Jan 1 of the tax year to asOf, so a
 * file made later always supersedes an earlier one for the same UID and the output stays deterministic.
 */
export function toICS(result: TaxResult, options: IcsOptions = {}): string {
  const stamp = `${toBasicDate(result.asOf)}T000000Z`;
  const sequence = Math.max(0, daysSinceYearStart(result.asOf));
  const events: CalendarEvent[] = [];

  for (const inst of result.installments) {
    if (inst.due < result.asOf) continue;
    const isNext = result.nextDeadline !== null && result.nextDeadline.quarter === inst.quarter;
    const amount = isNext && result.nextDeadline ? result.nextDeadline.amountDue : inst.plannedPayment;
    if (!(amount > 0)) continue;
    const label = `Q${inst.quarter} ${TAX_YEAR}`;
    const pastDueNote = isNext && result.nextDeadline?.includesPastDue ? " This amount includes an underpaid earlier instalment." : "";
    events.push({
      uid: `penaltyproof-${TAX_YEAR}-q${inst.quarter}@penaltyproof`,
      date: inst.due,
      summary: `Pay ${dollars(amount)} federal estimated tax (${label})`,
      description:
        `Federal estimated tax payment (Form 1040-ES) for ${label}, due ${inst.due}: ${dollars(amount)}.${pastDueNote} ` +
        `Pay with IRS Direct Pay: ${DIRECT_PAY_URL} (choose "Estimated Tax" and tax year ${TAX_YEAR}). ` +
        `Amounts are estimates from Penaltyproof as of ${result.asOf}; reopen the app to refresh them.`,
      alarm: `Federal estimated tax ${label} due in 3 days: ${dollars(amount)}`,
    });
  }

  const includeReturnDue = options.includeReturnDue ?? events.length === 0;
  if (includeReturnDue && RETURN_DUE >= result.asOf) {
    const owed = result.aprilTrueUp > 0;
    events.push({
      uid: `penaltyproof-${TAX_YEAR}-return@penaltyproof`,
      date: RETURN_DUE,
      summary: owed
        ? `Pay ${dollars(result.aprilTrueUp)} federal balance with your ${TAX_YEAR} return`
        : `File your ${TAX_YEAR} federal return`,
      description:
        (owed
          ? `Your ${TAX_YEAR} Form 1040 is due ${RETURN_DUE}, with an expected federal balance of ${dollars(result.aprilTrueUp)} after the planned estimated payments. `
          : `Your ${TAX_YEAR} Form 1040 is due ${RETURN_DUE}. No federal balance is expected after the planned estimated payments` +
            (result.aprilTrueUp < 0 ? ` (expected refund ${dollars(-result.aprilTrueUp)}). ` : ". ")) +
        `Pay with IRS Direct Pay: ${DIRECT_PAY_URL}. State returns and payments are not included. ` +
        `Amounts are estimates from Penaltyproof as of ${result.asOf}.`,
      alarm: `${TAX_YEAR} federal return due in 3 days`,
    });
  }

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Penaltyproof//Tax Engine//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`Federal estimated tax ${TAX_YEAR}`)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${sequence}`,
      `DTSTART;VALUE=DATE:${toBasicDate(e.date)}`,
      `DTEND;VALUE=DATE:${toBasicDate(addDays(e.date, 1))}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      `URL:${DIRECT_PAY_URL}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-P3D",
      `DESCRIPTION:${escapeText(e.alarm)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
