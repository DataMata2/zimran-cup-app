// Why a state with an income tax shows $0 (e.g. Ohio's business income deduction), from the engine's state
// table. Shown in the Breakdown so a $0 line doesn't look like a bug.

import type { StateCode, TaxResult } from "@/lib/tax";
import { STATES } from "@/lib/tax/constants/states2026";
import { money } from "./format";
import { stateName } from "./states";

export function zeroStateTaxNote(result: TaxResult, state: StateCode): string | null {
  if (result.tax.stateMethod === "none" || result.tax.state >= 0.5) return null;
  const rule = STATES[state];
  if (rule.kind === "flat" && rule.businessIncome) {
    const deduction = rule.businessIncome.deduction[result.input.filingStatus];
    return `${stateName(state)} deducts the first ${money(deduction)} of business income, including freelance profit, so your ${stateName(state)} income tax comes to $0.`;
  }
  return "note" in rule && rule.note ? rule.note : null;
}
