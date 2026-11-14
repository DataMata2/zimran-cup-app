// State income tax. Exact for no-tax, flat and bracket states; an approximate effective rate elsewhere.

import type { FilingStatus } from "./constants/federal2026";
import { STATES, type StateCode } from "./constants/states2026";
import { bracketTax } from "./federal";
import type { StateMethod } from "./types";

export interface StateTax {
  tax: number;
  method: StateMethod;
  name: string;
  verified: boolean;
  note: string | null;
}

export function stateRule(code: StateCode) {
  const rule = STATES[code];
  if (!rule) throw new Error(`Unknown state code "${String(code)}"`);
  return rule;
}

/**
 * @param federalAgi federal adjusted gross income
 * @param federalTaxable federal taxable income (after standard and QBI deductions)
 * @param businessIncomeInAgi business (Schedule C) income included in AGI: net 1099 profit minus the deductible
 *   half of SE tax. The whole SE-tax adjustment is treated as business, so AGI − this = W-2 wages.
 */
export function stateIncomeTax(
  code: StateCode,
  status: FilingStatus,
  federalAgi: number,
  federalTaxable: number,
  businessIncomeInAgi = 0,
): StateTax {
  const rule = stateRule(code);
  const meta = { name: rule.name, verified: rule.verified };
  switch (rule.kind) {
    case "none":
      return { tax: 0, method: "none", note: null, ...meta };
    case "flat": {
      const base = rule.base === "federalTaxable" ? federalTaxable : federalAgi;
      const bi = rule.businessIncome;
      if (!bi) {
        const taxable = Math.max(0, base - rule.deduction[status]);
        return { tax: taxable * rule.rate, method: "flat", note: rule.note ?? null, ...meta };
      }
      // Business income taken out of the base: exempt up to bi.deduction, the excess at bi.excessRate (Ohio
      // business income deduction). A business loss is left in the base (it reduces nonbusiness income).
      const business = Math.max(0, businessIncomeInAgi);
      const nonbusinessTaxable = Math.max(0, base - business - rule.deduction[status]);
      const businessExcess = Math.max(0, business - bi.deduction[status]);
      return {
        tax: nonbusinessTaxable * rule.rate + businessExcess * bi.excessRate,
        method: "flat",
        note: rule.note ?? null,
        ...meta,
      };
    }
    case "brackets": {
      const taxable = Math.max(0, federalAgi - rule.deduction[status]);
      return { tax: bracketTax(taxable, rule.brackets[status]), method: "brackets", note: rule.note ?? null, ...meta };
    }
    case "approx":
      return { tax: Math.max(0, federalAgi) * rule.effectiveRate, method: "approx", note: rule.note, ...meta };
  }
}
