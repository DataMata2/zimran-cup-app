/**
 * IRS worked examples and rule-isolating tests — independent oracle.
 *
 * Every expected value below was computed BY HAND from the primary IRS source cited next to it
 * (the arithmetic is shown line by line in comments). Nothing here was copied from running the engine,
 * and src/constants/ was deliberately NOT read.
 *
 * 2026 constants used (all confirmed from primary sources unless marked):
 *  - Tax rate schedules 2026 (Form 1040-ES 2026, "2026 Tax Rate Schedules", also Rev. Proc. 2025-32 §4.01)
 *      https://www.irs.gov/pub/irs-pdf/f1040es.pdf   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
 *      Single (Sched X): 10% ≤12,400 | 12% ≤50,400 | 22% ≤105,700 | 24% ≤201,775 | 32% ≤256,225 | 35% ≤640,600 | 37%
 *      MFJ (Sched Y-1):  10% ≤24,800 | 12% ≤100,800 | 22% ≤211,400 | 24% ≤403,550 | 32% ≤512,450 | 35% ≤768,700 | 37%
 *  - Standard deduction 2026 (Form 1040-ES 2026 chart; Rev. Proc. 2025-32 §4.14):
 *      single / MFS 16,100; MFJ / QSS 32,200; HOH 24,150
 *  - Social security wage base 2026 = 184,500 (Form 1040-ES 2026, SE worksheet line 5 "Social security tax
 *      maximum income $184,500"; matches SSA 2026 contribution and benefit base, https://www.ssa.gov/oact/cola/cbb.html)
 *  - SE: 92.35%, 12.4% SS, 2.9% Medicare, deduction 50% (Form 1040-ES 2026 SE worksheet lines 3, 4, 9, 11)
 *  - $400 net-earnings floor (Schedule SE / Form 2210 instr. Part II line 28)
 *  - Additional Medicare 0.9%, thresholds single/HOH 200,000, MFJ 250,000, MFS 125,000 (statutory, not indexed;
 *      Instructions for Form 8959 (2025) https://www.irs.gov/pub/irs-pdf/i8959.pdf)
 *  - QBI threshold 2026: 201,750 (single/other), 403,500 MFJ, 201,775 MFS (Rev. Proc. 2025-32 §4.26).
 *      Not exercised above-threshold here.
 *  - Safe harbor: 90% current / 100% prior / 110% if 2025 AGI > 150,000 (75,000 MFS); no estimates needed if
 *      < $1,000 owed after withholding, or no tax liability for a full 12-month 2025 year
 *      (Form 1040-ES 2026 "Who Must Make Estimated Tax Payments", "Higher income taxpayers", "Exception").
 *  - Deadlines 2026-04-15, 2026-06-15, 2026-09-15, 2027-01-15 (Form 1040-ES 2026 "When To Pay Estimated Tax").
 *  - Schedule AI (Form 2210 (2025) — 2026 form not yet published at the time of writing; the line LOGIC is
 *      used with 2026 constants): annualization 4 / 2.4 / 1.5 / 1, applicable % 22.5 / 45 / 67.5 / 90,
 *      prorated SS limit = wage base × 3/12, 5/12, 8/12, 12/12 → 2026: 46,125 / 76,875 / 123,000 / 184,500
 *      (2025 form shows 44,025 / 73,375 / 117,400 / 176,100 = 176,100 × same fractions).
 *      https://www.irs.gov/pub/irs-pdf/f2210.pdf  https://www.irs.gov/pub/irs-pdf/i2210.pdf
 *  NOT modelled (and therefore not tested): 2026 non-itemizer charitable deduction (1040-ES line 2a "up to
 *  $1,000"), Schedule 1-A deductions, the new $400 minimum QBID, credits.
 *
 * Tolerance: values the engine reports directly are compared with toBeCloseTo(x, 2) (|diff| < 0.005),
 * i.e. the engine's cent rounding of my exact figure. Sums of several separately-rounded outputs use ±$0.02.
 */
import { describe, expect, it } from "vitest";
import { estimate, annualized } from "../index";

const near = (actual: number, expected: number, tol = 0.02) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

const hasFlag = (r: { flags: { code: string }[] }, code: string) => r.flags.some((f) => f.code === code);

describe("Form 1040-ES 2026 — Self-Employment Tax and Deduction Worksheet (wage-base interaction)", () => {
  // Source: Form 1040-ES (2026), "2026 Self-Employment Tax and Deduction Worksheet for Lines 1 and 9".
  // https://www.irs.gov/pub/irs-pdf/f1040es.pdf
  it("W-2 wages $150,000 + net SE profit $60,000 (single): SS portion limited to base − wages", () => {
    // line 1/2  net profit             = 60,000
    // line 3    × 0.9235               = 55,410
    // line 4    × 0.029                = 1,606.89
    // line 5    SS maximum income      = 184,500
    // line 6    expected wages         = 150,000
    // line 7    5 − 6                  = 34,500
    // line 8    smaller of 3 or 7      = 34,500
    // line 9    × 0.124                = 4,278.00
    // line 10   4 + 9 (SE tax)         = 5,884.89
    // line 11   × 50% (deduction)      = 2,942.445
    // Form 8959 Part II: line 8 = 55,410; line 9 = 200,000; line 10 = 150,000; line 11 = 50,000;
    //   line 12 = 55,410 − 50,000 = 5,410; line 13 = 5,410 × 0.009 = 48.69
    const r = estimate({
      filingStatus: "single", state: "TX", asOf: "2026-03-01",
      expectedAnnual1099Income: 60000, w2Wages: 150000, w2Withholding: 30000,
      priorYearTax: null,
    });
    expect(r.tax.seSocialSecurity).toBeCloseTo(4278.0, 2);
    expect(r.tax.seMedicare).toBeCloseTo(1606.89, 2);
    expect(r.tax.seTax).toBeCloseTo(5884.89, 2);
    expect(r.tax.seDeduction).toBeCloseTo(2942.45, 1); // 2,942.445 → 2,942.44/45 depending on half-cent rounding
    expect(r.tax.additionalMedicare).toBeCloseTo(48.69, 2);
    // AGI = 150,000 + 60,000 − 2,942.445 = 207,057.555
    near(r.income.agi, 207057.56, 0.01);
    expect(hasFlag(r, "ss_wage_base_reached")).toBe(true);
    expect(hasFlag(r, "additional_medicare_applies")).toBe(true);
  });

  it("W-2 wages $190,000 (above the $184,500 base) + net SE profit $20,000: no SS part, Medicare only", () => {
    // line 3  = 20,000 × 0.9235 = 18,470
    // line 4  = 18,470 × 0.029  = 535.63
    // line 7  = 184,500 − 190,000 < 0 → "If line 7 is zero or less, enter -0- on line 9" → SS = 0
    // line 10 = 535.63
    // Form 8959: wages 190,000 ≤ 200,000 → Part I = 0; Part II line 11 = 200,000 − 190,000 = 10,000,
    //   line 12 = 18,470 − 10,000 = 8,470; line 13 = 8,470 × 0.009 = 76.23
    const r = estimate({
      filingStatus: "single", state: "TX", asOf: "2026-03-01",
      expectedAnnual1099Income: 20000, w2Wages: 190000, w2Withholding: 40000,
    });
    expect(r.tax.seSocialSecurity).toBeCloseTo(0, 2);
    expect(r.tax.seMedicare).toBeCloseTo(535.63, 2);
    expect(r.tax.seTax).toBeCloseTo(535.63, 2);
    expect(r.tax.additionalMedicare).toBeCloseTo(76.23, 2);
  });

  it("$400 floor: net earnings below $400 → no SE tax (Schedule SE); just above → full SE tax", () => {
    // 400 × 0.9235 = 369.40 < 400 → SE tax 0
    const lo = estimate({ filingStatus: "single", state: "TX", asOf: "2026-03-01", expectedAnnual1099Income: 400 });
    expect(lo.tax.seTax).toBeCloseTo(0, 2);
    // 500 × 0.9235 = 461.75 ≥ 400 → 461.75 × 0.153 = 70.64775 (SS 57.257 + Medicare 13.39075)
    const hi = estimate({ filingStatus: "single", state: "TX", asOf: "2026-03-01", expectedAnnual1099Income: 500 });
    expect(hi.tax.seTax).toBeCloseTo(70.65, 2);
  });
});

describe("Instructions for Form 8959 (2025) — Additional Medicare Tax examples", () => {
  // Source: https://www.irs.gov/pub/irs-pdf/i8959.pdf "Examples" (thresholds are statutory, unchanged for 2026).
  // The examples speak of "self-employment income" = net earnings (Schedule SE line 6), so the engine input
  // (net profit) is that amount / 0.9235.
  it("Example 1 (Ann, single, $130,000 SE income, $0 wages): not liable → 0", () => {
    const r = estimate({ filingStatus: "single", state: "TX", asOf: "2026-03-01", expectedAnnual1099Income: 130000 / 0.9235 });
    expect(r.tax.additionalMedicare).toBeCloseTo(0, 2);
  });

  it("Example 2 (Bob, single, $220,000 SE income): liable on $20,000 → $180.00", () => {
    // 220,000 − 200,000 = 20,000 × 0.009 = 180.00
    const r = estimate({ filingStatus: "single", state: "TX", asOf: "2026-03-01", expectedAnnual1099Income: 220000 / 0.9235 });
    expect(r.tax.additionalMedicare).toBeCloseTo(180.0, 2);
  });

  it("Example 3 (Carl, single, $145,000 SE income + $130,000 wages): threshold reduced to $70,000 → $675.00", () => {
    // reduced threshold 200,000 − 130,000 = 70,000; 145,000 − 70,000 = 75,000 × 0.009 = 675.00
    const r = estimate({
      filingStatus: "single", state: "TX", asOf: "2026-03-01",
      expectedAnnual1099Income: 145000 / 0.9235, w2Wages: 130000, w2Withholding: 20000,
    });
    expect(r.tax.additionalMedicare).toBeCloseTo(675.0, 2);
  });

  it("Example 4 (Don, MFS, $150,000 SE income + $200,000 wages): $75,000 wages + $150,000 SE → $2,025.00", () => {
    // wages: 200,000 − 125,000 = 75,000; SE threshold 125,000 − 200,000 → 0; SE 150,000 − 0 = 150,000
    // (75,000 + 150,000) × 0.009 = 2,025.00
    const r = estimate({
      filingStatus: "mfs", state: "TX", asOf: "2026-03-01",
      expectedAnnual1099Income: 150000 / 0.9235, w2Wages: 200000, w2Withholding: 40000,
    });
    expect(r.tax.additionalMedicare).toBeCloseTo(2025.0, 2);
  });

  it("Line 13 example (Kathleen & Liam, MFJ: her $130,000 wages, his $140,000 SE income) → $180.00", () => {
    // threshold 250,000 − 130,000 = 120,000; 140,000 − 120,000 = 20,000 × 0.009 = 180.00
    // Wages are Kathleen's, so they do NOT reduce Liam's SS wage base (w2WagesOfFreelancer = 0):
    //   SS = 140,000 × 0.124 = 17,360 (140,000 < 184,500); Medicare = 140,000 × 0.029 = 4,060
    const r = estimate({
      filingStatus: "mfj", state: "TX", asOf: "2026-03-01",
      expectedAnnual1099Income: 140000 / 0.9235, w2Wages: 130000, w2WagesOfFreelancer: 0, w2Withholding: 15000,
    });
    expect(r.tax.additionalMedicare).toBeCloseTo(180.0, 2);
    expect(r.tax.seSocialSecurity).toBeCloseTo(17360.0, 2);
    expect(r.tax.seMedicare).toBeCloseTo(4060.0, 2);
  });
});

describe("Form 1040-ES 2026 — who must pay / required annual payment rules", () => {
  // Source: Form 1040-ES (2026) "Who Must Make Estimated Tax Payments", "Exception", "Higher income taxpayers",
  // Estimated Tax Worksheet lines 12a–12c. https://www.irs.gov/pub/irs-pdf/f1040es.pdf
  it("< $1,000 owed after withholding → no estimates required", () => {
    // net profit 7,000: 7,000 × 0.9235 = 6,464.50; SE = 6,464.50 × 0.153 = 989.0685
    // AGI = 7,000 − 494.534 = 6,505.47 < 16,100 std deduction → income tax 0
    // total 989.07 < 1,000 → noneRequired, required annual payment 0
    const r = estimate({ filingStatus: "single", state: "TX", asOf: "2026-03-01", expectedAnnual1099Income: 7000, priorYearTax: 5000, priorYearAgi: 40000 });
    expect(r.tax.federalTotal).toBeCloseTo(989.07, 2);
    expect(r.safeHarbor.rule).toBe("noneRequired");
    expect(r.safeHarbor.requiredAnnualPayment).toBe(0);
    expect(hasFlag(r, "no_estimates_required")).toBe(true);
  });

  it("No tax liability for a full 12-month 2025 → noneRequired; same with a short prior year → 90% current", () => {
    // designer: net profit 60,000 → federalTotal 12,037.19896 (see personas.test.ts for the full computation)
    const base = { filingStatus: "single" as const, state: "TX" as const, asOf: "2026-03-01", expectedAnnual1099Income: 60000, priorYearTax: 0, priorYearAgi: 0 };
    const full = estimate({ ...base, priorYearFullYear: true });
    expect(full.safeHarbor.rule).toBe("noneRequired");
    expect(full.safeHarbor.requiredAnnualPayment).toBe(0);
    // 100%-of-prior-year option requires a 12-month 2025 return (i2210 "Required Annual Payment" item 2),
    // so with a short year only 90% current applies: 0.9 × 12,037.19896 = 10,833.479
    const short = estimate({ ...base, priorYearFullYear: false });
    expect(short.safeHarbor.rule).toBe("current90");
    expect(short.safeHarbor.requiredAnnualPayment).toBeCloseTo(10833.48, 2);
  });

  it("110% applies only when 2025 AGI is MORE than $150,000 ($75,000 MFS)", () => {
    // designer federalTotal 12,037.19896 → 90% = 10,833.479; prior tax 9,000
    const base = { state: "TX" as const, asOf: "2026-03-01", expectedAnnual1099Income: 60000, priorYearTax: 9000 };
    // AGI exactly 150,000 (not more) → 100% × 9,000 = 9,000 < 10,833.48 → prior100
    const at = estimate({ ...base, filingStatus: "single", priorYearAgi: 150000 });
    expect(at.safeHarbor.rule).toBe("prior100");
    expect(at.safeHarbor.requiredAnnualPayment).toBeCloseTo(9000, 2);
    // AGI 150,001 → 110% × 9,000 = 9,900 < 10,833.48 → prior110
    const over = estimate({ ...base, filingStatus: "single", priorYearAgi: 150001 });
    expect(over.safeHarbor.rule).toBe("prior110");
    expect(over.safeHarbor.requiredAnnualPayment).toBeCloseTo(9900, 2);
    // MFS: threshold 75,000. AGI 80,000 → 110% → 9,900. (MFS designer: same std deduction 16,100 and
    // same single-like brackets up to 201,775 → same federalTotal 12,037.20 → 90% = 10,833.48)
    const mfs = estimate({ ...base, filingStatus: "mfs", priorYearAgi: 80000 });
    expect(mfs.safeHarbor.rule).toBe("prior110");
    expect(mfs.safeHarbor.requiredAnnualPayment).toBeCloseTo(9900, 2);
  });
});

describe("Instructions for Form 2210 (2025) — Example 3: crediting payments to instalments", () => {
  // Source: https://www.irs.gov/pub/irs-pdf/i2210.pdf, Penalty Worksheet, Example 3:
  // "Your required installment for each payment due date is $4,000. You made the following estimated tax
  //  payments: 04/30 $2,000; 06/15 $3,000; 09/15 $4,000; 01/15 $4,000." Line 1a: (a) 4,000, (b)–(d) 3,000.
  // Payments are applied in the order made to the earliest underpayment (line 1b note).
  // Shifted to 2026 dates. To get a required instalment of exactly $4,000 we need RAP = 16,000:
  //   single, net profit 100,000, TX: SE = 92,350 × 0.153 = 14,129.55; ded 7,064.775; AGI 92,935.225;
  //   pre-QBI taxable 76,835.225; QBI 0.2 × 76,835.225 = 15,367.045; taxable 61,468.18;
  //   tax = 5,800 + 0.22 × (61,468.18 − 50,400) = 8,234.9996; total 22,364.55 → 90% = 20,128.09
  //   prior 16,000 (AGI 90,000 ≤ 150k → 100%) → RAP = min(20,128.09, 16,000) = 16,000 → 4,000/quarter.
  it("payments 2,000+3,000+4,000+4,000 credit 4,000 / 4,000 / 4,000 / 1,000; Q4 cumulative shortfall 3,000", () => {
    // Applying in date order to the earliest unpaid instalment:
    //   04-30 2,000 → Q1 (2,000 left of Q1)
    //   06-15 3,000 → Q1 +2,000 (full), Q2 +1,000
    //   09-15 4,000 → Q2 +3,000 (full), Q3 +1,000
    //   01-15 4,000 → Q3 +3,000 (full), Q4 +1,000
    //   credited: 4,000 / 4,000 / 4,000 / 1,000; cumulative paid 13,000; Q4: 16,000 − 13,000 = 3,000 short
    //   (matches the example's line 1a column (d) = $3,000)
    const r = estimate({
      filingStatus: "single", state: "TX", asOf: "2027-01-20",
      expectedAnnual1099Income: 100000, priorYearTax: 16000, priorYearAgi: 90000,
      estimatedPaymentsMade: [
        { date: "2026-04-30", amount: 2000 },
        { date: "2026-06-15", amount: 3000 },
        { date: "2026-09-15", amount: 4000 },
        { date: "2027-01-15", amount: 4000 },
      ],
    });
    expect(r.safeHarbor.rule).toBe("prior100");
    expect(r.safeHarbor.requiredAnnualPayment).toBeCloseTo(16000, 2);
    expect(r.installments.map((i) => i.required)).toEqual([4000, 4000, 4000, 4000]);
    expect(r.installments.map((i) => i.paymentsCredited)).toEqual([4000, 4000, 4000, 1000]);
    expect(r.installments[3]!.cumulativePaid).toBeCloseTo(13000, 2);
    expect(r.installments[3]!.shortfall).toBeCloseTo(3000, 2);
    expect(r.nextDeadline).toBeNull(); // asOf after 2027-01-15: year over
  });
});

describe("Form 2210 Schedule AI — rule: evenly earned income gives the same instalments as the regular method", () => {
  // Source: Form 2210 (2025) Schedule AI lines 1–27 and Part II lines 28–36; https://www.irs.gov/pub/irs-pdf/f2210.pdf
  // Rule isolated: with income earned evenly each month, cumulative income × annualization amount
  // (12/3, 12/5, 12/8, 12/12) = the full-year income in every column, so line 19 = full-year tax T in every
  // column and line 21 = 22.5%·T, 45%·T, 67.5%·T, 90%·T; line 23 = 22.5%·T each. With prior-year tax unknown
  // RAP = 90%·T, so line 24 = 25% × 0.9·T = 22.5%·T. Required (line 27) = 22.5%·T each; savings 0.
  // Designer: net 60,000 → T = 12,037.19896 (personas.test.ts). 0.225 × T = 2,708.36977.
  // Check column (a) by hand: income through 3/31 = 15,000 × 4 = 60,000; Part II line 28 = 15,000 × 0.9235 =
  //   13,852.50; line 29 = 184,500 × 3/12 = 46,125; line 33 = 0.496 × 13,852.50 = 6,870.84;
  //   line 35 = 0.116 × 13,852.50 = 1,606.89; line 36 = 8,477.73 = full-year SE tax ✓.
  it("12 equal monthly payments of $5,000 → each required instalment = 2,708.37", () => {
    const payments1099 = Array.from({ length: 12 }, (_, m) => ({
      date: `2026-${String(m + 1).padStart(2, "0")}-15`, amount: 5000,
    }));
    // asOf 2026-12-31 so every payment is already received (no YTD extrapolation).
    const a = annualized({ filingStatus: "single", state: "TX", asOf: "2026-12-31", payments1099, priorYearTax: null });
    expect(a.installments.map((i) => i.applicablePct)).toEqual([0.225, 0.45, 0.675, 0.9]);
    for (const inst of a.installments) expect(inst.required).toBeCloseTo(2708.37, 2);
    near(a.totalRequired, 10833.48);
    near(a.savingsVsRegular, 0);
  });
});
