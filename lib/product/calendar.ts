// The calendar file for /plan, built in the browser from the engine result (toICS), so income figures
// never leave the page in a URL.

import { toICS, type TaxResult } from "@/lib/tax";

export const ICS_FILENAME = "penaltyproof-2026.ics";
export const ICS_TYPE = "text/calendar;charset=utf-8";

/** Each remaining 2026 deadline with its amount and a reminder, plus the April 15, 2027 return. */
export function calendarFile(result: TaxResult): string {
  return toICS(result, { includeReturnDue: true });
}
