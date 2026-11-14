// The server copy of a guest's plan: what is stored, how it is checked, and when it replaces local data.
// Pure (no Next or browser imports) so the API route and the client sync share it and it is unit-tested.

import type { LogEntry, Profile } from "./types";
import { isLogEntry, isProfile } from "./validate";

/** Largest PUT /api/plan-data body (bytes), checked before parsing. */
export const PLAN_DATA_MAX_BYTES = 64 * 1024;

/**
 * What the server keeps for a guest. `added` is the free-tier counter (pp.v1.added), so the limit survives a
 * restore. `profile: null` with an empty log is a cleared plan ("Start over"), which restores nothing.
 */
export interface PlanData {
  v: 1;
  profile: Profile | null;
  log: LogEntry[];
  added: number;
}

/**
 * Check data from outside (a request body or a database row) and return it as PlanData, or null when any part
 * is malformed. `v` is optional on input (a PUT body has none) but must be 1 when present.
 */
export function parsePlanData(value: unknown): PlanData | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (o.v !== undefined && o.v !== 1) return null;
  if (o.profile !== null && !isProfile(o.profile)) return null;
  if (!Array.isArray(o.log) || !o.log.every(isLogEntry)) return null;
  const added = o.added ?? 0;
  if (typeof added !== "number" || !Number.isSafeInteger(added) || added < 0) return null;
  const profile = o.profile === null ? null : pickProfile(o.profile as Profile);
  if (profile === null && o.log.length > 0) return null;
  return { v: 1, profile, log: (o.log as LogEntry[]).map(pickEntry), added: Math.max(added, o.log.length) };
}

/** Keep only the known fields, so nothing extra is stored. */
function pickProfile(p: Profile): Profile {
  return {
    filingStatus: p.filingStatus,
    state: p.state,
    ytdIncome: p.ytdIncome,
    expectedIncome: p.expectedIncome,
    w2Wages: p.w2Wages,
    w2Withholding: p.w2Withholding,
    priorYearTax: p.priorYearTax,
    priorYearAgi: p.priorYearAgi,
    estimatedPaid: p.estimatedPaid,
    createdAt: p.createdAt,
    isExample: p.isExample,
  };
}

function pickEntry(e: LogEntry): LogEntry {
  return { id: e.id, kind: e.kind, amount: e.amount, payer: e.payer, date: e.date, setAside: e.setAside, createdAt: e.createdAt };
}

/** Local data counts as empty when there is no profile and no logged entry. */
export function isLocalEmpty(local: { profile: Profile | null; log: readonly LogEntry[] }): boolean {
  return local.profile === null && local.log.length === 0;
}

/**
 * Merge rule: local wins whenever it has anything. The server copy is restored only into an empty browser,
 * and only when it holds a plan (a cleared copy restores nothing).
 */
export function shouldRestore(
  local: { profile: Profile | null; log: readonly LogEntry[] },
  server: PlanData | null,
): server is PlanData & { profile: Profile } {
  return isLocalEmpty(local) && server !== null && server.profile !== null;
}
