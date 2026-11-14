// Federal constants, tax year 2026.
// Every value below was checked against the cited primary source on 2026-11-14 (see ../../CONSTANTS.md).

export type FilingStatus = "single" | "mfj" | "mfs" | "hoh" | "qss";

/** upTo = top of bracket (taxable income), null = no cap. */
export interface Bracket {
  upTo: number | null;
  rate: number;
}

export const TAX_YEAR = 2026;

// Source: IRS Rev. Proc. 2025-32, sec. 4.01 (Tables 1-4), https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
const SINGLE: Bracket[] = [
  { upTo: 12400, rate: 0.1 },
  { upTo: 50400, rate: 0.12 },
  { upTo: 105700, rate: 0.22 },
  { upTo: 201775, rate: 0.24 },
  { upTo: 256225, rate: 0.32 },
  { upTo: 640600, rate: 0.35 },
  { upTo: null, rate: 0.37 },
];
const MFJ: Bracket[] = [
  { upTo: 24800, rate: 0.1 },
  { upTo: 100800, rate: 0.12 },
  { upTo: 211400, rate: 0.22 },
  { upTo: 403550, rate: 0.24 },
  { upTo: 512450, rate: 0.32 },
  { upTo: 768700, rate: 0.35 },
  { upTo: null, rate: 0.37 },
];
const MFS: Bracket[] = [
  { upTo: 12400, rate: 0.1 },
  { upTo: 50400, rate: 0.12 },
  { upTo: 105700, rate: 0.22 },
  { upTo: 201775, rate: 0.24 },
  { upTo: 256225, rate: 0.32 },
  { upTo: 384350, rate: 0.35 },
  { upTo: null, rate: 0.37 },
];
const HOH: Bracket[] = [
  { upTo: 17700, rate: 0.1 },
  { upTo: 67450, rate: 0.12 },
  { upTo: 105700, rate: 0.22 },
  { upTo: 201750, rate: 0.24 },
  { upTo: 256200, rate: 0.32 },
  { upTo: 640600, rate: 0.35 },
  { upTo: null, rate: 0.37 },
];

export const BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: SINGLE,
  mfj: MFJ,
  mfs: MFS,
  hoh: HOH,
  qss: MFJ, // qualifying surviving spouse uses the MFJ table (IRC 1(a))
};

// Source: IRS Rev. Proc. 2025-32, sec. 4.14, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 16100,
  mfj: 32200,
  mfs: 16100,
  hoh: 24150,
  qss: 32200,
};

export const SE = {
  netEarningsFactor: 0.9235, // 2026 Schedule SE line 4a, https://www.irs.gov/pub/irs-pdf/f1040sse.pdf
  ssRate: 0.124, // 2026 Schedule SE line 10, https://www.irs.gov/pub/irs-pdf/f1040sse.pdf
  medicareRate: 0.029, // 2026 Schedule SE line 11, https://www.irs.gov/pub/irs-pdf/f1040sse.pdf
  ssWageBase: 184500, // SSA 2026 contribution and benefit base, https://www.ssa.gov/oact/cola/cbb.html (also 2026 Sched SE line 7)
  minNetEarnings: 400, // 2026 Schedule SE line 4c ("If less than $400, stop"), https://www.irs.gov/pub/irs-pdf/f1040sse.pdf
  deductibleShare: 0.5, // 2026 Schedule SE line 13, https://www.irs.gov/pub/irs-pdf/f1040sse.pdf
};

// Source: Form 8959 instructions (2025; thresholds are statutory, IRC 1401(b)(2), not indexed),
// https://www.irs.gov/pub/irs-pdf/i8959.pdf -- MFJ $250,000, MFS $125,000, single/HOH/QSS $200,000.
export const ADDITIONAL_MEDICARE: { rate: number; threshold: Record<FilingStatus, number> } = {
  rate: 0.009,
  threshold: { single: 200000, mfj: 250000, mfs: 125000, hoh: 200000, qss: 200000 },
};

// Source: IRS Rev. Proc. 2025-32, sec. 4.26, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
// Table gives threshold and threshold+phase-in end: MFJ $403,500 / $553,500; MFS $201,775 / $276,775;
// all other returns $201,750 / $276,750. phaseInRange = end - threshold ($150,000 joint, $75,000 others,
// as widened by OBBBA sec. 70105). QSS is not a joint return for 199A(e)(2) -> "all other returns".
// Not modeled here: OBBBA 199A(i) minimum deduction ($400 if >= $1,000 QBI, active business), Rev. Proc. 2025-32 sec. 3.12.
export const QBI: {
  rate: number;
  threshold: Record<FilingStatus, number>;
  phaseInRange: Record<FilingStatus, number>;
} = {
  rate: 0.2, // IRC 199A(a)
  threshold: { single: 201750, mfj: 403500, mfs: 201775, hoh: 201750, qss: 201750 },
  phaseInRange: { single: 75000, mfj: 150000, mfs: 75000, hoh: 75000, qss: 75000 },
};

// Source: 2026 Form 1040-ES, "Who Must Make Estimated Tax" + "Higher income taxpayers", and worksheet
// lines 12a/12b, https://www.irs.gov/pub/irs-pdf/f1040es.pdf. 110% applies if 2025 AGI > $150,000
// ($75,000 if 2026 filing status is MFS).
export const SAFE_HARBOR: {
  currentYearPct: number;
  priorYearPct: number;
  highIncomePriorYearPct: number;
  highIncomeAgi: Record<FilingStatus, number>;
  minBalanceDue: number;
} = {
  currentYearPct: 0.9,
  priorYearPct: 1.0,
  highIncomePriorYearPct: 1.1,
  highIncomeAgi: { single: 150000, mfj: 150000, mfs: 75000, hoh: 150000, qss: 150000 },
  minBalanceDue: 1000,
};

// Source: 2026 Form 1040-ES, "When To Pay Estimated Tax" table: April 15, 2026 (Wed), June 15, 2026 (Mon),
// Sept. 15, 2026 (Tue), Jan. 15, 2027 (Fri) -- all weekdays, so no holiday/weekend shift.
// https://www.irs.gov/pub/irs-pdf/f1040es.pdf
// periodStart/periodEnd: the months each instalment covers; periodEnd matches the 2026 Form 2210 Schedule AI
// column headings (1/1/26-3/31/26, -5/31/26, -8/31/26, -12/31/26). Schedule AI periods are CUMULATIVE from 1/1.
// https://www.irs.gov/pub/irs-dft/f2210--dft.pdf (2026 draft)
export const DEADLINES: { quarter: 1 | 2 | 3 | 4; due: string; periodStart: string; periodEnd: string }[] = [
  { quarter: 1, due: "2026-04-15", periodStart: "2026-01-01", periodEnd: "2026-03-31" },
  { quarter: 2, due: "2026-06-15", periodStart: "2026-04-01", periodEnd: "2026-05-31" },
  { quarter: 3, due: "2026-09-15", periodStart: "2026-06-01", periodEnd: "2026-08-31" },
  { quarter: 4, due: "2027-01-15", periodStart: "2026-09-01", periodEnd: "2026-12-31" },
];

// UNVERIFIED: from the 2026 early-release DRAFT Form 2210 (final 2026 form not yet published).
// Due date of the 2026 return and of any balance due: the 15th day of the 4th month after the year ends,
// IRC 6072(a), https://www.law.cornell.edu/uscode/text/26/6072 ; 2026 Form 1040-ES ("file your 2026 Form 1040 ...
// by April 15, 2027"), https://www.irs.gov/pub/irs-pdf/f1040es.pdf . April 15, 2027 is a Thursday, so no
// weekend/holiday shift (IRC 7503).
export const RETURN_DUE = "2027-04-15";

// Source: 2026 Form 2210 Schedule AI (early-release DRAFT), https://www.irs.gov/pub/irs-dft/f2210--dft.pdf
// (identical structure to final 2025 form https://www.irs.gov/pub/irs-pdf/f2210.pdf).
// Part II (annualized SE tax), per column:
//   line 28 net earnings from SE for the period = net profit for the period x 0.9235 (0 if < $400) [i2210, Line 28]
//   line 29 prorated SS tax limit = $46,125 / $76,875 / $123,000 / $184,500
//           = SE.ssWageBase x ssWageBaseFraction (0.25, 5/12, 2/3, 1)
//   line 31 = max(0, line 29 - actual SS wages for the period)
//   line 33 = 0.124 x seFactors[i] (0.496 / 0.2976 / 0.186 / 0.124) x min(line 28, line 31)
//   line 35 = 0.029 x seFactors[i] (0.116 / 0.0696 / 0.0435 / 0.029) x line 28
// Note: the prorated limit is NOT annualized; it is compared with un-annualized period earnings.
// Part I line 7: the FULL-year standard deduction is used in every column (not annualized).
export const ANNUALIZATION: {
  factors: number[];
  applicablePct: number[];
  seFactors: number[];
  ssWageBaseFraction: number[];
} = {
  factors: [4, 2.4, 1.5, 1], // Sched AI lines 2 and 5
  applicablePct: [0.225, 0.45, 0.675, 0.9], // Sched AI line 20
  seFactors: [4, 2.4, 1.5, 1], // Sched AI lines 32/34 are 12.4% / 2.9% x these
  ssWageBaseFraction: [3 / 12, 5 / 12, 8 / 12, 12 / 12], // Sched AI line 29 / $184,500 (46,125 / 76,875 / 123,000 / 184,500)
};

// IRS underpayment interest rate for individuals (IRC 6621(a)(2): federal short-term rate + 3 points), set per
// calendar quarter. IRC 6654(a) charges the estimated-tax penalty at this rate, so each Revenue Ruling also says
// "the N percent rate also applies to estimated tax underpayments" for that quarter. Used by
// estimateAccruedPenalty (penalty.ts). Checked on 2026-11-14:
// - 2026 Q1 7%: Rev. Rul. 2025-22, IRB 2025-48, https://www.irs.gov/irb/2025-48_IRB ; news release IR-2025-112
//   (Nov. 13, 2025), https://www.irs.gov/newsroom/interest-rates-remain-the-same-for-the-first-quarter-of-2026
// - 2026 Q2 6%: Rev. Rul. 2026-5, IRB 2026-8, https://www.irs.gov/irb/2026-08_IRB
// - 2026 Q3 7%: Rev. Rul. 2026-10, IRB 2026-22, https://www.irs.gov/irb/2026-22_IRB
// - 2026 Q4 7%: Rev. Rul. 2026-15, IRB 2026-36, https://www.irs.gov/irb/2026-36_irb ; news release IR-2026-98
//   (Aug. 21, 2026), https://www.irs.gov/newsroom/interest-rates-remain-the-same-for-the-fourth-quarter-of-2026
// - Summary table: https://www.irs.gov/payments/quarterly-interest-rates
// - 2027 Q1 and Q2 7%: UNVERIFIED. Not yet published on 2026-11-14; the latest confirmed rate (2026 Q4) is used.
//   The penalty for tax year 2026 stops on 2027-04-15 (RETURN_DUE), so only Apr 1-15 of 2027 Q2 can be used.
// The Form 2210 penalty worksheet counts days on a 365-day year (2026 and 2027 both have 365 days).
export const UNDERPAYMENT_RATES: { from: string; to: string; rate: number; verified: boolean }[] = [
  { from: "2026-01-01", to: "2026-03-31", rate: 0.07, verified: true },
  { from: "2026-04-01", to: "2026-06-30", rate: 0.06, verified: true },
  { from: "2026-07-01", to: "2026-09-30", rate: 0.07, verified: true },
  { from: "2026-10-01", to: "2026-12-31", rate: 0.07, verified: true },
  { from: "2027-01-01", to: "2027-03-31", rate: 0.07, verified: false }, // UNVERIFIED (see above)
  { from: "2027-04-01", to: "2027-06-30", rate: 0.07, verified: false }, // UNVERIFIED (see above)
];
export const PENALTY_DAYS_PER_YEAR = 365;
