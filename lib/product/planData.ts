// The server copy of a guest's plan: what is stored, how it is checked, and when it replaces local data.
// Pure (no Next or browser imports) so the API route and the client sync share it and it is unit-tested.

import { countedEntries } from "./freeLimit";
import type { LogEntry, Profile } from "./types";
import { isLogEntry, isProfile, logEntrySaveError, profileSaveError } from "./validate";

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
  return { v: 1, profile, log: (o.log as LogEntry[]).map(pickEntry), added: Math.max(added, countedEntries(o.log as LogEntry[])) };
}

/**
 * SH-06: why a parsed plan can't be SAVED, or null when it can. Used by PUT only: GET and restore never run it,
 * so a copy stored before these rules still loads. `now` is the server's clock (see latestClientToday).
 */
export function planDataSaveError(data: PlanData, now: Date): string | null {
  if (data.profile !== null) {
    const err = profileSaveError(data.profile);
    if (err) return err;
  }
  for (const entry of data.log) {
    const err = logEntrySaveError(entry, now);
    if (err) return err;
  }
  return null;
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

/** A cleared plan ("Start over"): no profile, nothing logged. */
export function isClearedPlan(data: { profile: Profile | null; log: readonly LogEntry[] }): boolean {
  return data.profile === null && data.log.length === 0;
}

/**
 * Merge rule: local wins whenever it has anything. The server copy is restored only into an empty browser,
 * and only when it holds a real plan (not a cleared copy, not the example persona).
 */
export function shouldRestore(
  local: { profile: Profile | null; log: readonly LogEntry[] },
  server: PlanData | null,
): server is PlanData & { profile: Profile } {
  return isLocalEmpty(local) && server !== null && server.profile !== null && !server.profile.isExample;
}

/**
 * The PUT body the sync sends for this local state, or null when nothing should be sent: no plan (only an
 * explicit "Start over" clears the copy, see `clearedBody`) or the example persona (it must never replace
 * someone's real copy).
 */
export function syncBody(local: { profile: Profile | null; log: readonly LogEntry[]; added: number }): string | null {
  if (local.profile === null || local.profile.isExample) return null;
  return JSON.stringify({ profile: local.profile, log: local.log, added: local.added });
}

/** The body that clears the copy, sent only by "Start over" on a real (non-example) plan. */
export function clearedBody(local: { profile: Profile | null }): string | null {
  if (local.profile === null || local.profile.isExample) return null;
  return JSON.stringify({ profile: null, log: [], added: 0 });
}
