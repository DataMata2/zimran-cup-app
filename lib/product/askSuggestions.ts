// The example questions on the Ask card, picked to fit this plan.

import type { TaxResult } from "@/lib/tax";

export const Q4_HIGHER = "Why is my Q4 payment higher?";
export const APRIL_OWED = "What will I owe with my April return?";

/** "Why is my Q4 payment higher?" only when the Q4 required amount is really higher than the earlier quarters'. */
export function askSuggestions(result: TaxResult): string[] {
  const q4 = result.installments.find((i) => i.quarter === 4);
  const earlier = result.installments.filter((i) => i.quarter < 4).map((i) => i.required);
  const q4Higher = q4 !== undefined && earlier.length > 0 && q4.required >= Math.max(...earlier) + 0.5;
  return [q4Higher ? Q4_HIGHER : APRIL_OWED, "What if I earn $10,000 more?", "What happens if I skip a payment?"];
}
