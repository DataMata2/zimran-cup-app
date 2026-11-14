// estimate(): the full-year federal + state estimate, safe harbor, schedule, set-aside and flags.

import { ADDITIONAL_MEDICARE, SAFE_HARBOR, TAX_YEAR, type FilingStatus } from "./constants/federal2026";
import type { StateCode } from "./constants/states2026";
import { YEAR_END, YEAR_START } from "./dates";
import { federalIncomeTax, federalMarginalRate, qbiDeduction, standardDeduction, type QbiZone } from "./federal";
import { isJoint, normalizeInput, PROJECTION_EARLY_DAYS, resolveIncome, splitEstimatedPayments, type FreelanceIncome } from "./income";
import { clamp, formatPct, round2, roundRate } from "./money";
import { safeHarbor, type SafeHarbor } from "./safeHarbor";
import { buildSchedule, type Schedule } from "./schedule";
import { additionalMedicareTax, selfEmploymentTax, type SeTax } from "./se";
import { stateIncomeTax, type StateTax } from "./state";
import type { DatedAmount, Flag, NormalizedInput, TaxInput, TaxResult } from "./types";

/** Upper bound of the recommended set-aside rate (a product choice, not a tax number). */
export const SET_ASIDE_MAX_RATE = 0.6;
/** Rounding tolerance before W-2 withholding is called short of the wage-only tax (dollars; not a tax number). */
export const UNDERWITHHELD_TOLERANCE = 1;

export interface AnnualTaxes {
  net1099: number;
  w2Wages: number;
  se: SeTax;
  additionalMedicare: number;
  agi: number;
  standardDeduction: number;
  taxableBeforeQbi: number;
  qbiDeduction: number;
  qbiZone: QbiZone;
  taxableIncome: number;
  federalIncomeTax: number;
  federalTotal: number;
  marginalFederal: number;
  state: StateTax;
}

/** Federal (income + SE + Additional Medicare) and state tax for one full year of income. */
export function annualTaxes(
  status: FilingStatus,
  state: StateCode,
  net1099: number,
  w2Wages: number,
  w2WagesOfFreelancer: number,
): AnnualTaxes {
  const se = selfEmploymentTax(net1099, w2WagesOfFreelancer);
  const additionalMedicare = additionalMedicareTax(w2Wages, se.netEarnings, status);
  const agi = net1099 + w2Wages - se.deduction;
  const std = standardDeduction(status);
  const taxableBeforeQbi = Math.max(0, agi - std);
  const qbi = qbiDeduction(net1099 - se.deduction, taxableBeforeQbi, status);
  const taxableIncome = Math.max(0, taxableBeforeQbi - qbi.deduction);
  const incomeTax = federalIncomeTax(taxableIncome, status);
  return {
    net1099,
    w2Wages,
    se,
    additionalMedicare,
    agi,
    standardDeduction: std,
    taxableBeforeQbi,
    qbiDeduction: qbi.deduction,
    qbiZone: qbi.zone,
    taxableIncome,
    federalIncomeTax: incomeTax,
    federalTotal: incomeTax + se.total + additionalMedicare,
    marginalFederal: federalMarginalRate(taxableIncome, status),
    state: stateIncomeTax(state, status, agi, taxableIncome, net1099 - se.deduction),
  };
}

/** Everything estimate() computes, unrounded. Shared with annualized(). */
export interface EstimateModel {
  input: NormalizedInput;
  income: FreelanceIncome;
  taxes: AnnualTaxes;
  /** The same return with no 1099 income (W-2 wages only). */
  wageOnly: AnnualTaxes;
  /** (federalTotal + state) − (the same for wageOnly): the tax caused by the freelance income. */
  freelanceTax: number;
  creditedPayments: DatedAmount[];
  ignoredPayments: DatedAmount[];
  safeHarbor: SafeHarbor;
  schedule: Schedule;
}

export function buildModel(raw: TaxInput): EstimateModel {
  const input = normalizeInput(raw);
  const income = resolveIncome(input);
  const tax = (net1099: number) => annualTaxes(input.filingStatus, input.state, net1099, input.w2Wages, input.w2WagesOfFreelancer);
  const taxes = tax(income.netAnnual);
  const wageOnly = tax(0);
  const freelanceTax = taxes.federalTotal + taxes.state.tax - (wageOnly.federalTotal + wageOnly.state.tax);
  const { credited, ignored } = splitEstimatedPayments(input);
  // Safe harbor and instalments are whole-return figures (Form 2210 looks at the whole return).
  const sh = safeHarbor({
    status: input.filingStatus,
    federalTotal: taxes.federalTotal,
    w2Withholding: input.w2Withholding,
    priorYearTax: input.priorYearTax,
    priorYearAgi: input.priorYearAgi,
    priorYearFullYear: input.priorYearFullYear,
  });
  const schedule = buildSchedule(sh.requiredAnnualPayment, input.w2Withholding, credited, input.asOf);
  return { input, income, taxes, wageOnly, freelanceTax, creditedPayments: credited, ignoredPayments: ignored, safeHarbor: sh, schedule };
}

function buildFlags(m: EstimateModel): Flag[] {
  const { input, income, taxes, wageOnly, safeHarbor: sh, schedule } = m;
  const flags: Flag[] = [];
  const add = (code: Flag["code"], message: string) => flags.push({ code, message });

  if (taxes.state.method === "approx") {
    add("state_approximate", `${taxes.state.name} tax uses an approximate effective rate on federal AGI, not the state's own rules.`);
  }
  if (taxes.state.tax > 0) {
    add("state_estimates_not_scheduled", `${taxes.state.name} estimated payments and deadlines are not included in this schedule; only federal 1040-ES instalments are.`);
  }
  if (input.state === "NY") add("nyc_not_included", "New York City (and Yonkers) resident income tax is not included.");
  if (taxes.qbiZone === "phaseIn") {
    add(
      "qbi_phase_in",
      "Taxable income is inside the QBI phase-in range. The deduction is figured as for a specified service business (SSTB) " +
        "with no W-2 payroll or property: only the applicable percentage of QBI counts (IRC §199A(d)(3)) and the W-2 wage " +
        "limit then removes the phased-in share again (Form 8995-A Part III), i.e. 20% × QBI × (1 − p)². This is the " +
        "smallest deduction allowed; a non-SSTB or a business with payroll may get more.",
    );
  } else if (taxes.qbiZone === "above") {
    add(
      "qbi_above_threshold",
      "Taxable income is above the QBI phase-in range. The deduction is taken as $0, which is right for a specified service " +
        "business (IRC §199A(d)(3), Form 8995-A); a non-SSTB with W-2 payroll or property may still get a deduction.",
    );
  }
  if (input.priorYearTax === null) {
    add("prior_year_unknown", `${TAX_YEAR - 1} tax is unknown, so the safe harbor uses ${formatPct(SAFE_HARBOR.currentYearPct)} of ${TAX_YEAR} tax; entering ${TAX_YEAR - 1} tax may lower the required payments.`);
  } else if (!input.priorYearFullYear) {
    add("prior_year_partial", `The ${TAX_YEAR - 1} return did not cover 12 months, so the prior-year safe harbor is not available.`);
  }
  if (income.projected) {
    add("income_projected", "Full-year freelance income was projected from income so far at the same daily pace.");
  }
  if (income.projectionEarly) {
    add(
      "projection_early",
      `The full-year figure is extrapolated from less than ${PROJECTION_EARLY_DAYS} days of income and may be far off; enter your expected annual income.`,
    );
  }
  if (income.ytdAssumed && input.expectedAnnual1099Income !== null && input.asOf > YEAR_START) {
    add("ytd_assumed_even", "Income received so far was not given, so it is assumed earned evenly through the year to date.");
  }
  if (input.w2OwnerAssumed) {
    add(
      "w2_owner_assumed_spouse",
      "On a joint return the W-2 wages are assumed to be the spouse's, so they do not reduce the self-employed person's " +
        "Social Security wage base (conservative). If the self-employed person earned some of them, enter that amount.",
    );
  }
  if (isJoint(input.filingStatus) && income.netAnnual > 0) {
    add(
      "mfj_one_self_employed_assumed",
      "All 1099 income is treated as one person's self-employment income (one Schedule SE, one Social Security wage base). " +
        "If both spouses are self-employed, each has their own wage base and SE tax may differ.",
    );
  }
  if (m.ignoredPayments.length > 0) {
    const dates = m.ignoredPayments.map((p) => `${p.date} ($${p.amount.toFixed(2)})`).join(", ");
    add(
      "payment_ignored_out_of_range",
      `Estimated payments dated before ${YEAR_START} or after today (${input.asOf}) are not counted: ${dates}. A payment counts from the day it is made.`,
    );
  }
  if (wageOnly.federalTotal > input.w2Withholding + UNDERWITHHELD_TOLERANCE) {
    add(
      "w2_underwithheld",
      `Your W-2 withholding doesn't cover the federal tax on your wages alone (about $${round2(wageOnly.federalTotal).toFixed(2)}); adjust your W-4. ` +
        "The shortfall is part of the instalments but not of the freelance set-aside rate.",
    );
  }
  if (sh.rule !== "noneRequired" && input.w2Withholding >= sh.requiredAnnualPayment) {
    add(
      "withholding_covers_safe_harbor",
      "Your W-2 withholding alone meets the required annual payment, so no estimated payments are needed to avoid the penalty; any balance is due with the return.",
    );
  }
  if (income.expectedBelowYtd) {
    add("expected_below_ytd", "Expected annual freelance income was below income already received; the received amount is used.");
  }
  if (income.netAnnual < 0) {
    add("net_loss", "Freelance income after expenses is a loss: no SE tax, no QBI deduction, and the loss reduces AGI.");
  }
  if (schedule.installments.some((x) => x.status === "pastDue")) {
    add("past_due_installment", "An earlier instalment is underpaid. Paying it now stops further penalty; the amount is included in the next deadline.");
  }
  if (sh.rule === "noneRequired") add("no_estimates_required", sh.reason);
  if (taxes.additionalMedicare > 0) {
    add("additional_medicare_applies", `Wages and self-employment earnings are above the Additional Medicare Tax threshold (${formatPct(ADDITIONAL_MEDICARE.rate)} applies).`);
  }
  if (taxes.se.wageBaseReached && (taxes.se.netEarnings > 0 || input.w2WagesOfFreelancer > 0)) {
    add("ss_wage_base_reached", "Social Security wage base is reached; earnings above it owe only the Medicare part of SE tax.");
  }
  if (schedule.nextDeadline === null) {
    add("tax_year_over", `All ${TAX_YEAR} estimated-tax deadlines have passed; the remaining balance is due with the return.`);
  }
  add("credits_not_modeled", "Tax credits (child tax credit, education, energy, etc.), itemized deductions and the new 2026 deductions (e.g. the $400 minimum QBI deduction) are not modeled; the standard deduction is used.");
  return flags;
}

export function estimate(raw: TaxInput): TaxResult {
  const m = buildModel(raw);
  const { input, income, taxes, safeHarbor: sh, schedule } = m;

  const stateTax = taxes.state.tax;
  const effectiveOnFreelance = income.netAnnual > 0 ? m.freelanceTax / income.netAnnual : 0;

  // Set-aside, two rates:
  //  - rate: the steady share of every freelance dollar (= effective rate on freelance income).
  //  - catchUpRate: for someone who has saved nothing so far: freelance-caused tax still unpaid, per dollar of
  //    freelance income still to come. Estimated payments count against it; withholding counts only for the
  //    part above the tax on wages alone (W-2 under-withholding is flagged, not loaded onto freelance income).
  //    With no income left it falls back to the effective rate.
  const excessWithholding = Math.max(0, input.w2Withholding - m.wageOnly.federalTotal);
  const remainingLiability = m.freelanceTax - schedule.totalPayments - excessWithholding;
  const remainingIncome = income.netAnnual - income.netYtd;
  const yearOver = input.asOf > YEAR_END;
  const useRemaining = remainingIncome > 0 && !yearOver;
  const setAsideRate = clamp(effectiveOnFreelance, 0, SET_ASIDE_MAX_RATE);
  const catchUpRate = clamp(useRemaining ? remainingLiability / remainingIncome : effectiveOnFreelance, 0, SET_ASIDE_MAX_RATE);

  const aprilTrueUp = taxes.federalTotal - input.w2Withholding - (schedule.totalPayments + schedule.remainingPlanned);

  return {
    taxYear: TAX_YEAR,
    asOf: input.asOf,
    input,
    income: {
      net1099Annual: round2(income.netAnnual),
      net1099Ytd: round2(income.netYtd),
      w2Wages: round2(input.w2Wages),
      agi: round2(taxes.agi),
      standardDeduction: round2(taxes.standardDeduction),
      qbiDeduction: round2(taxes.qbiDeduction),
      taxableIncome: round2(taxes.taxableIncome),
      projected: income.projected,
    },
    tax: {
      seTax: round2(taxes.se.total),
      seSocialSecurity: round2(taxes.se.socialSecurity),
      seMedicare: round2(taxes.se.medicare),
      additionalMedicare: round2(taxes.additionalMedicare),
      seDeduction: round2(taxes.se.deduction),
      federalIncomeTax: round2(taxes.federalIncomeTax),
      federalTotal: round2(taxes.federalTotal),
      state: round2(stateTax),
      stateMethod: taxes.state.method,
      total: round2(taxes.federalTotal + stateTax),
      freelanceTax: round2(m.freelanceTax),
    },
    rates: {
      marginalFederal: roundRate(taxes.marginalFederal),
      effectiveOnFreelance: roundRate(effectiveOnFreelance),
    },
    safeHarbor: {
      rule: sh.rule,
      requiredAnnualPayment: round2(sh.requiredAnnualPayment),
      currentYearOption: round2(sh.currentYearOption),
      priorYearOption: sh.priorYearOption === null ? null : round2(sh.priorYearOption),
      reason: sh.reason,
    },
    installments: schedule.installments.map((x) => ({
      quarter: x.quarter,
      due: x.due,
      required: round2(x.required),
      withholdingCredited: round2(x.withholdingCredited),
      paymentsCredited: round2(x.paymentsCredited),
      cumulativeRequired: round2(x.cumulativeRequired),
      cumulativePaid: round2(x.cumulativePaid),
      shortfall: round2(x.shortfall),
      plannedPayment: round2(x.plannedPayment),
      status: x.status,
    })),
    nextDeadline: schedule.nextDeadline && {
      quarter: schedule.nextDeadline.quarter,
      due: schedule.nextDeadline.due,
      amountDue: round2(schedule.nextDeadline.amountDue),
      includesPastDue: schedule.nextDeadline.includesPastDue,
    },
    aprilTrueUp: round2(aprilTrueUp),
    setAside: {
      rate: roundRate(setAsideRate),
      catchUpRate: roundRate(catchUpRate),
      method:
        `rate: set this share aside from every freelance payment — the tax your freelance income adds (federal + state, ` +
        `vs. the same return without it) divided by your expected freelance income for the year. ` +
        (useRemaining
          ? `catchUpRate: use this instead if you have set nothing aside so far — the freelance tax still unpaid (after ` +
            `estimated payments made and withholding beyond the tax on your wages) divided by the freelance income still to come. `
          : `catchUpRate: equals rate, since no freelance income is left to come. `) +
        `Both are clamped to 0–${formatPct(SET_ASIDE_MAX_RATE)}.`,
    },
    progress: {
      paidToDate: round2(schedule.progress.paidToDate),
      requiredToDate: round2(schedule.progress.requiredToDate),
      pct: round2(schedule.progress.pct),
      annualRequired: round2(schedule.progress.annualRequired),
      annualPaid: round2(schedule.progress.annualPaid),
    },
    flags: buildFlags(m),
  };
}

/** Dollars to set aside from one freelance payment, at the result's set-aside rate. */
export function setAsideForPayment(result: TaxResult, amount: number): { amount: number; setAside: number; rate: number } {
  if (typeof amount !== "number" || !Number.isFinite(amount)) throw new Error("amount must be a finite number");
  const a = Math.max(0, amount);
  const rate = result.setAside.rate;
  return { amount: round2(a), setAside: round2(a * rate), rate };
}
