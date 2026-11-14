// The "Try with an example" persona: Maya, a freelance product designer in California, single.
// Covered Q1 + Q2 with $3,700 of estimates, missed Q3, and was just paid $4,200 by Northwind Studio.

import { estimate } from "@/lib/tax";
import { buildTaxInput } from "./input";
import { setAsideAfterLogging } from "./plan";
import type { NewLogEntry, Profile } from "./types";

export const EXAMPLE_NAME = "Maya";
export const EXAMPLE_DESCRIPTION = "Freelance product designer in California, single";

/** The example quiz answers, without the timestamp. */
export const EXAMPLE_ANSWERS: Omit<Profile, "createdAt"> = {
  filingStatus: "single",
  state: "CA",
  ytdIncome: 52000,
  expectedIncome: 64000,
  w2Wages: 0,
  w2Withholding: 0,
  priorYearTax: 7400,
  priorYearAgi: 49000,
  estimatedPaid: 3700,
  isExample: true,
};

/** The pre-logged payment, before its set-aside is computed. */
export const EXAMPLE_PAYMENT = { kind: "income", amount: 4200, payer: "Northwind Studio", date: "2026-11-03" } as const;

/**
 * The example profile and its pre-logged entry for `asOf`. The entry's `setAside` is computed by the
 * engine on the plan with the entry added, the same rule as a real logged payment (see setAsideAfterLogging).
 */
export function buildExample(asOf: string, now: Date = new Date()): { profile: Profile; entry: NewLogEntry } {
  const profile: Profile = { ...EXAMPLE_ANSWERS, createdAt: now.toISOString() };
  const before = estimate(buildTaxInput(profile, [], asOf));
  const { setAside } = setAsideAfterLogging(profile, [], EXAMPLE_PAYMENT, asOf, before);
  return { profile, entry: { ...EXAMPLE_PAYMENT, setAside } };
}
