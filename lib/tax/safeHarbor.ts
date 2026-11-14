// Required annual payment (IRC 6654(d); 2026 Form 1040-ES worksheet lines 12a-12c; Form 2210 Part I).

import { SAFE_HARBOR, TAX_YEAR, type FilingStatus } from "./constants/federal2026";
import { formatPct as pct } from "./money";
import type { SafeHarborRule } from "./types";

export interface SafeHarborInput {
  status: FilingStatus;
  /** Current-year federal total tax (income tax + SE tax + Additional Medicare), no credits modeled. */
  federalTotal: number;
  w2Withholding: number;
  priorYearTax: number | null;
  priorYearAgi: number | null;
  priorYearFullYear: boolean;
}

export interface SafeHarbor {
  rule: SafeHarborRule;
  requiredAnnualPayment: number;
  currentYearOption: number;
  /** null when the prior-year option is not available (unknown tax or a short prior year). */
  priorYearOption: number | null;
  /** Percentage of prior-year tax used (1.00 or 1.10), null if no prior option. */
  priorYearPct: number | null;
  /** Prior-year AGI was unknown, so the higher-income percentage was assumed. */
  priorAgiAssumedHigh: boolean;
  reason: string;
}

const PRIOR = TAX_YEAR - 1;
const usd = (x: number) => `$${x.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function safeHarbor(s: SafeHarborInput): SafeHarbor {
  const currentYearOption = SAFE_HARBOR.currentYearPct * s.federalTotal;
  const priorAvailable = s.priorYearTax !== null && s.priorYearFullYear;
  const threshold = SAFE_HARBOR.highIncomeAgi[s.status];
  // Higher-income rule applies when prior AGI > threshold. Unknown AGI: assume it applies (never under-pays).
  const priorAgiAssumedHigh = priorAvailable && s.priorYearAgi === null;
  const highIncome = s.priorYearAgi === null ? true : s.priorYearAgi > threshold;
  const priorYearPct = priorAvailable ? (highIncome ? SAFE_HARBOR.highIncomePriorYearPct : SAFE_HARBOR.priorYearPct) : null;
  const priorYearOption = priorAvailable && priorYearPct !== null ? priorYearPct * (s.priorYearTax as number) : null;

  const base = { currentYearOption, priorYearOption, priorYearPct, priorAgiAssumedHigh };
  const balance = s.federalTotal - s.w2Withholding;

  if (priorAvailable && s.priorYearTax === 0) {
    return {
      ...base,
      rule: "noneRequired",
      requiredAnnualPayment: 0,
      reason: `Your ${PRIOR} tax was $0 on a full-year return, so no ${TAX_YEAR} estimated payments are required.`,
    };
  }
  if (balance < SAFE_HARBOR.minBalanceDue) {
    return {
      ...base,
      rule: "noneRequired",
      requiredAnnualPayment: 0,
      reason: `Your ${TAX_YEAR} tax after withholding is expected to be under ${usd(SAFE_HARBOR.minBalanceDue)}, so no estimated payments are required.`,
    };
  }
  if (priorYearOption !== null && priorYearOption < currentYearOption) {
    const rule: SafeHarborRule = priorYearPct === SAFE_HARBOR.highIncomePriorYearPct ? "prior110" : "prior100";
    const why =
      rule === "prior110"
        ? priorAgiAssumedHigh
          ? ` (${pct(SAFE_HARBOR.highIncomePriorYearPct)} because your ${PRIOR} AGI is unknown and may exceed ${usd(threshold)})`
          : ` (${pct(SAFE_HARBOR.highIncomePriorYearPct)} because your ${PRIOR} AGI was over ${usd(threshold)})`
        : "";
    return {
      ...base,
      rule,
      requiredAnnualPayment: priorYearOption,
      reason: `Paying ${pct(priorYearPct as number)} of your ${PRIOR} tax${why} is less than ${pct(SAFE_HARBOR.currentYearPct)} of your expected ${TAX_YEAR} tax.`,
    };
  }
  return {
    ...base,
    rule: "current90",
    requiredAnnualPayment: currentYearOption,
    reason:
      priorYearOption === null
        ? `${pct(SAFE_HARBOR.currentYearPct)} of your expected ${TAX_YEAR} tax (the prior-year option is not available: ${
            s.priorYearTax === null ? `${PRIOR} tax unknown` : `${PRIOR} was not a full-year return`
          }).`
        : `${pct(SAFE_HARBOR.currentYearPct)} of your expected ${TAX_YEAR} tax is less than ${pct(priorYearPct as number)} of your ${PRIOR} tax.`,
  };
}
