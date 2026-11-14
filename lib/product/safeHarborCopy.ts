// The safe-harbor sentence on /plan, with both options in dollars, built from the engine's safeHarbor
// fields (no tax maths here). The AI's facts carry the same sentence, so every number it cites is on the page.

import type { TaxResult } from "@/lib/tax";
import { money, pct } from "./format";

/** The prior-year share the engine used (1 or 1.1), from its option and the prior-year tax it was given. */
function priorShare(r: TaxResult): number | null {
  const tax = r.input.priorYearTax;
  const option = r.safeHarbor.priorYearOption;
  if (option === null || tax === null || !(tax > 0)) return null;
  return Math.round((option / tax) * 100) / 100;
}

/** The engine's own explanation of the 110% rule, e.g. "because your 2025 AGI was over $150,000". */
function highIncomeWhy(reason: string): string | null {
  const m = /\(\d+% (because [^)]*)\)/.exec(reason);
  return m ? m[1]! : null;
}

export interface SafeHarborCopy {
  says: string;
  ninetyPercentOfExpected2026Tax: string;
  /** null when the prior-year option isn't available. */
  priorYearOption: { share: string; amount: string } | null;
  minimumFor2026: string;
}

export function safeHarborCopy(r: TaxResult): SafeHarborCopy {
  const sh = r.safeHarbor;
  const ninety = money(sh.currentYearOption);
  const share = priorShare(r);
  const prior = sh.priorYearOption !== null && share !== null ? { share: pct(share, 0), amount: money(sh.priorYearOption) } : null;
  const min = money(sh.requiredAnnualPayment);
  const base = { ninetyPercentOfExpected2026Tax: ninety, priorYearOption: prior, minimumFor2026: min };

  if (sh.rule === "noneRequired") {
    if (r.input.priorYearTax === 0 && r.input.priorYearFullYear) {
      return {
        ...base,
        says: `Your 2025 tax was $0 on a full-year return, so no 2026 estimated payments are required, even though 90% of your expected 2026 tax is ${ninety}.`,
      };
    }
    return { ...base, says: sh.reason };
  }
  if ((sh.rule === "prior100" || sh.rule === "prior110") && prior) {
    const why = sh.rule === "prior110" ? highIncomeWhy(sh.reason) : null;
    return {
      ...base,
      says: `Paying ${prior.share} of your 2025 tax (${prior.amount}${why ? `, ${why}` : ""}) is less than 90% of your expected 2026 tax (${ninety}), so ${min} is your minimum for the year.`,
    };
  }
  if (prior) {
    return {
      ...base,
      says: `90% of your expected 2026 tax (${ninety}) is less than ${prior.share} of your 2025 tax (${prior.amount}), so ${min} is your minimum for the year.`,
    };
  }
  const missing =
    r.input.priorYearTax === null
      ? "Without your 2025 tax, the prior-year option isn't available."
      : "Your 2025 return wasn't for a full year, so the prior-year option isn't available.";
  return { ...base, says: `Your minimum for the year is 90% of your expected 2026 tax: ${min}. ${missing}` };
}
