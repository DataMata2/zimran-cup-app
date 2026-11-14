// Shape checks for product data that arrives from outside the code: localStorage (stale, edited, or from
// another version) and request bodies on the AI routes. The engine still validates the tax fields.

import type { FilingStatus } from "@/lib/tax";
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
