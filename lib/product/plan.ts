// Pure helpers behind the /plan screen: run the engine safely, and pick what the screen shows from its result.
// Nothing here computes tax; every amount is read from the engine's TaxResult.

import { estimate, TaxInputError, type Flag, type FlagCode, type TaxInput, type TaxResult } from "@/lib/tax";
import { buildTaxInput } from "./input";
import type { LogEntry, Profile } from "./types";

/** Free tier: this many logged entries (income + IRS payments together). The next one needs Pro. */
export const FREE_LOG_LIMIT = 3;

/** True when adding one more entry needs Pro. `used` = entries ever added (see ./freeLimit), not the log length. */
export function needsPro(used: number, pro: boolean): boolean {
  return !pro && used >= FREE_LOG_LIMIT;
}

export type PlanOutcome =
  | { ok: true; input: TaxInput; result: TaxResult }
  | { ok: false; error: TaxInputError };

/**
 * The engine's plan for this profile and log as of `asOf`. A stale or edited profile that the engine
 * rejects comes back as `{ ok: false }` instead of throwing, so the page can offer to re-enter it.
 */
export function computePlan(profile: Profile, log: readonly LogEntry[], asOf: string): PlanOutcome {
  try {
    const input = buildTaxInput(profile, log, asOf);
    return { ok: true, input, result: estimate(input) };
  } catch (err) {
    if (err instanceof TaxInputError) return { ok: false, error: err };
    throw err;
  }
}

/** Flags shown elsewhere on the screen (the hero already explains a past-due amount). */
const SHOWN_ELSEWHERE: readonly FlagCode[] = ["past_due_installment"];
/** Flags that read as fine print, under the breakdown. */
const FOOTNOTE: readonly FlagCode[] = ["credits_not_modeled"];

/** The engine's flags split into notes and footnotes, one per code, in the engine's order. */
export function planNotes(flags: readonly Flag[]): { notes: Flag[]; footnotes: Flag[] } {
  const seen = new Set<FlagCode>();
  const notes: Flag[] = [];
  const footnotes: Flag[] = [];
  for (const f of flags) {
    if (seen.has(f.code) || SHOWN_ELSEWHERE.includes(f.code)) continue;
    seen.add(f.code);
    (FOOTNOTE.includes(f.code) ? footnotes : notes).push(f);
  }
  return { notes, footnotes };
}
