// The states the engine supports, for pickers. Names come from the engine's constants; no tax data here.

import { STATES } from "@/lib/tax/constants/states2026";
import type { StateCode } from "@/lib/tax";

export interface StateOption {
  code: StateCode;
  name: string;
}

/** Every engine StateCode with its full name, sorted by name. */
export const STATE_OPTIONS: readonly StateOption[] = (Object.keys(STATES) as StateCode[])
  .map((code) => ({ code, name: STATES[code].name }))
  .sort((a, b) => a.name.localeCompare(b.name, "en-US"));

/** Full name of a state code, e.g. "CA" → "California". */
export function stateName(code: StateCode): string {
  return STATES[code].name;
}

/** Type guard for untrusted strings (URL params, storage). */
export function isStateCode(value: unknown): value is StateCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STATES, value);
}
