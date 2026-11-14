// Public types of the engine. Every result type is plain JSON: numbers, strings, booleans, null,
// arrays and plain objects only (no classes, Dates, functions or undefined values).

import type { FilingStatus } from "./constants/federal2026";
import type { StateCode } from "./constants/states2026";

export type { FilingStatus, StateCode };

/** ISO date (YYYY-MM-DD) and an amount in dollars. */
export interface DatedAmount {
  date: string;
  amount: number;
}

/**
 * Engine input.
 *
 * Freelance income, one interpretation everywhere: ytd1099Income, expectedAnnual1099Income and payments1099
 * are amounts RECEIVED (before the businessExpenses field). Net Schedule C profit = received − businessExpenses.
 * If you already enter profit after expenses, leave businessExpenses at 0 (the default). businessExpenses is an
 * annual figure, assumed to accrue evenly over the year, so YTD profit = max(0, received so far − expenses ×
 * fraction of the year elapsed). When only a full-year figure is given (no YTD, no payments), income is
 * assumed earned evenly by day, both for YTD in estimate() and for the periods in annualized().
 */
export interface TaxInput {
  filingStatus: FilingStatus;
  state: StateCode;
  /** ISO date that counts as "today", 2026-01-01 .. 2027-04-15. */
  asOf: string;
  /** Freelance income received so far in 2026 (before businessExpenses). */
  ytd1099Income?: number;
  /** Freelance income expected for the full year 2026 (before businessExpenses). */
  expectedAnnual1099Income?: number;
  /** Dated freelance payments received (before businessExpenses). When given, they replace ytd1099Income. */
  payments1099?: DatedAmount[];
  /** Annual business expenses, subtracted from the 1099 amounts above. Default 0 (amounts are already net). */
  businessExpenses?: number;
  /** Annual household W-2 wages (box 1 is assumed equal to boxes 3 and 5). Default 0. */
  w2Wages?: number;
  /** Federal income tax withholding expected for all of 2026. Default 0. */
  w2Withholding?: number;
  /**
   * Part of w2Wages earned by the self-employed person (reduces their Social Security wage base).
   * Default: w2Wages for single / hoh / mfs / qss; 0 for mfj (conservative; flagged w2_owner_assumed_spouse).
   */
  w2WagesOfFreelancer?: number;
  /** 2025 total tax (Form 1040 line 24). null or missing = unknown. */
  priorYearTax?: number | null;
  /** 2025 adjusted gross income. null or missing = unknown. */
  priorYearAgi?: number | null;
  /** The 2025 return covered a full 12-month year. Default true. */
  priorYearFullYear?: boolean;
  /** Federal Form 1040-ES payments made for tax year 2026. Only those dated 2026-01-01..asOf are credited. */
  estimatedPaymentsMade?: DatedAmount[];
}

/** TaxInput after defaults are applied. Every key is present; unknown values are null. */
export interface NormalizedInput {
  filingStatus: FilingStatus;
  state: StateCode;
  asOf: string;
  ytd1099Income: number | null;
  expectedAnnual1099Income: number | null;
  payments1099: DatedAmount[] | null;
  businessExpenses: number;
  w2Wages: number;
  w2Withholding: number;
  w2WagesOfFreelancer: number;
  /** w2WagesOfFreelancer was not given on a joint return and was assumed 0 (the wages are the spouse's). */
  w2OwnerAssumed: boolean;
  priorYearTax: number | null;
  priorYearAgi: number | null;
  priorYearFullYear: boolean;
  /** Echo of every payment given, including any the schedule ignored (see flag payment_ignored_out_of_range). */
  estimatedPaymentsMade: DatedAmount[];
}

export type FlagCode =
  | "state_approximate"
  | "state_estimates_not_scheduled"
  | "qbi_above_threshold"
  | "qbi_phase_in"
  | "prior_year_unknown"
  | "prior_year_partial"
  | "income_projected"
  | "expected_below_ytd"
  | "past_due_installment"
  | "no_estimates_required"
  | "credits_not_modeled"
  | "additional_medicare_applies"
  | "ss_wage_base_reached"
  | "nyc_not_included"
  | "net_loss"
  | "tax_year_over"
  | "annualized_income_assumed_even"
  | "w2_owner_assumed_spouse"
  | "mfj_one_self_employed_assumed"
  | "payment_ignored_out_of_range"
  | "projection_early"
  | "ytd_assumed_even"
  | "w2_underwithheld"
  | "withholding_covers_safe_harbor";

export interface Flag {
  code: FlagCode;
  message: string;
}

export type SafeHarborRule = "current90" | "prior100" | "prior110" | "noneRequired";
export type InstallmentStatus = "paid" | "due" | "pastDue" | "upcoming";
export type StateMethod = "none" | "flat" | "brackets" | "approx";

export interface Installment {
  quarter: 1 | 2 | 3 | 4;
  due: string;
  /** 25% of the required annual payment. */
  required: number;
  /** W-2 withholding deemed paid on this due date (25% of annual withholding). */
  withholdingCredited: number;
  /** Estimated payments applied to this instalment (earliest unpaid instalment first). */
  paymentsCredited: number;
  cumulativeRequired: number;
  cumulativePaid: number;
  /** Cumulative unpaid required amount through this instalment, never negative. */
  shortfall: number;
  /** Amount the plan says to pay on this due date (0 for past due dates; past-due amounts roll into the next one). */
  plannedPayment: number;
  status: InstallmentStatus;
}

export interface TaxResult {
  taxYear: number;
  asOf: string;
  input: NormalizedInput;
  income: {
    net1099Annual: number;
    net1099Ytd: number;
    w2Wages: number;
    agi: number;
    standardDeduction: number;
    qbiDeduction: number;
    taxableIncome: number;
    projected: boolean;
  };
  tax: {
    seTax: number;
    seSocialSecurity: number;
    seMedicare: number;
    additionalMedicare: number;
    seDeduction: number;
    federalIncomeTax: number;
    /** federalIncomeTax + seTax + additionalMedicare. */
    federalTotal: number;
    state: number;
    stateMethod: StateMethod;
    /** federalTotal + state. */
    total: number;
    /** Tax caused by the freelance income: total − (the same return computed with no 1099 income). */
    freelanceTax: number;
  };
  rates: {
    marginalFederal: number;
    /** freelanceTax / net1099Annual (0 when there is no freelance profit). */
    effectiveOnFreelance: number;
  };
  safeHarbor: {
    rule: SafeHarborRule;
    requiredAnnualPayment: number;
    currentYearOption: number;
    priorYearOption: number | null;
    reason: string;
  };
  installments: Installment[];
  nextDeadline: {
    quarter: 1 | 2 | 3 | 4;
    due: string;
    amountDue: number;
    includesPastDue: boolean;
  } | null;
  /** Federal balance at filing (due 2027-04-15) if the plan is followed. Positive = owed, negative = refund. */
  aprilTrueUp: number;
  setAside: {
    /** Steady share of every freelance dollar to set aside: effectiveOnFreelance clamped to [0, 0.6]. */
    rate: number;
    /** Share of each new freelance dollar for someone who has saved nothing so far (remaining tax / remaining income), clamped to [0, 0.6]. */
    catchUpRate: number;
    method: string;
  };
  progress: {
    paidToDate: number;
    requiredToDate: number;
    pct: number;
    annualRequired: number;
    annualPaid: number;
  };
  flags: Flag[];
}

export interface AnnualizedInstallment {
  quarter: 1 | 2 | 3 | 4;
  due: string;
  periodEnd: string;
  /** Schedule AI line 3: income for the period times the annualization factor. */
  annualizedIncome: number;
  /** Schedule AI line 17: tax on the annualized amounts (income tax + SE tax + Additional Medicare). */
  annualizedTax: number;
  applicablePct: number;
  /** Schedule AI line 21: annualized tax x applicable % minus earlier required instalments, never negative. */
  annualizedInstallment: number;
  /** Schedule AI line 24: 25% of the required annual payment plus unused regular amounts carried over. */
  regularInstallment: number;
  /** Schedule AI line 25: the smaller of the two. */
  required: number;
}

export interface AnnualizedResult {
  taxYear: number;
  asOf: string;
  requiredAnnualPayment: number;
  installments: AnnualizedInstallment[];
  totalRequired: number;
  /** Sum over instalments of max(0, 25% of required annual payment − annualized required). */
  savingsVsRegular: number;
  flags: Flag[];
}
