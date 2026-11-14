// annualized(): Form 2210 Schedule AI (annualized income installment method), regular instalments
// compared column by column. Line numbers refer to the 2025 Schedule AI (same layout in the 2026 draft).

import { ANNUALIZATION, DEADLINES, SE, STANDARD_DEDUCTION, TAX_YEAR } from "./constants/federal2026";
import { buildModel } from "./estimate";
import { federalIncomeTax, qbiDeduction } from "./federal";
import { round2, roundRate } from "./money";
import { additionalMedicareTax } from "./se";
import type { AnnualizedInstallment, AnnualizedResult, Flag, TaxInput } from "./types";

export function annualized(raw: TaxInput): AnnualizedResult {
  const { input, income, safeHarbor: sh } = buildModel(raw);
  const status = input.filingStatus;
  const rap = sh.requiredAnnualPayment;
  const regularShare = rap / DEADLINES.length; // line 22: 25% of the required annual payment

  let priorRequired = 0; // line 20: sum of line 25 in earlier columns
  let carry = 0; // line 23: line 24 − line 25 of the previous column
  let deferred = 0;
  const installments: AnnualizedInstallment[] = DEADLINES.map((d, i) => {
    const factor = ANNUALIZATION.factors[i] as number; // lines 2 and 5
    const seFactor = ANNUALIZATION.seFactors[i] as number;
    const pct = ANNUALIZATION.applicablePct[i] as number;
    const wageFraction = ANNUALIZATION.ssWageBaseFraction[i] as number;

    // Income from Jan 1 to the period end. W-2 wages are assumed earned evenly (period share = 1/factor).
    const periodNet = income.cumulativeNet(d.periodEnd);
    const periodWages = input.w2Wages / factor;
    const periodSsWages = input.w2WagesOfFreelancer / factor;

    // Part II, annualized SE tax.
    let ne = Math.max(0, periodNet) * SE.netEarningsFactor; // line 28
    if (ne < SE.minNetEarnings) ne = 0;
    const ssLimit = SE.ssWageBase * wageFraction; // line 29 (prorated, not annualized)
    const ssRoom = Math.max(0, ssLimit - periodSsWages); // line 31
    const ssPart = SE.ssRate * seFactor * Math.min(ne, ssRoom); // line 33
    const medicarePart = SE.medicareRate * seFactor * ne; // line 35
    const annualizedSe = ssPart + medicarePart; // line 36

    // Part I. The deduction for half of SE tax for the period is line 36 × 50% ÷ the annualization factor.
    const periodSeDeduction = (SE.deductibleShare * annualizedSe) / factor;
    const periodAgi = periodNet + periodWages - periodSeDeduction; // line 1
    const annualizedIncome = periodAgi * factor; // line 3
    const taxableBeforeQbi = Math.max(0, annualizedIncome - STANDARD_DEDUCTION[status]); // lines 7-9 (full std deduction)
    const qbi = qbiDeduction((periodNet - periodSeDeduction) * factor, taxableBeforeQbi, status).deduction; // line 10
    const taxable = Math.max(0, taxableBeforeQbi - qbi); // line 11
    const addlMedicare = additionalMedicareTax(periodWages * factor, ne * factor, status); // line 14 (Form 8959, annualized)
    const annualizedTax = federalIncomeTax(taxable, status) + annualizedSe + addlMedicare; // lines 12-17, no credits

    const annualizedInstallment = Math.max(0, annualizedTax * pct - priorRequired); // lines 19-21
    const regularInstallment = regularShare + carry; // line 24
    const required = Math.min(annualizedInstallment, regularInstallment); // line 25
    carry = regularInstallment - required;
    priorRequired += required;
    deferred += Math.max(0, regularShare - required);

    return {
      quarter: d.quarter,
      due: d.due,
      periodEnd: d.periodEnd,
      annualizedIncome: round2(annualizedIncome),
      annualizedTax: round2(annualizedTax),
      applicablePct: roundRate(pct),
      annualizedInstallment: round2(annualizedInstallment),
      regularInstallment: round2(regularInstallment),
      required: round2(required),
    };
  });

  const flags: Flag[] = [];
  if (income.evenSpread) {
    flags.push({
      code: "annualized_income_assumed_even",
      message: "No dated freelance payments were given, so income is assumed to be earned evenly; the annualized method helps only when income is uneven.",
    });
  }
  if (sh.rule === "noneRequired") flags.push({ code: "no_estimates_required", message: sh.reason });
  flags.push({
    code: "credits_not_modeled",
    message: "Tax credits and itemized deductions are not modeled; the full standard deduction is used in every period.",
  });

  return {
    taxYear: TAX_YEAR,
    asOf: input.asOf,
    requiredAnnualPayment: round2(rap),
    installments,
    totalRequired: round2(priorRequired),
    savingsVsRegular: round2(deferred),
    flags,
  };
}
