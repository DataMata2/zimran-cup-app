/**
 * Hand-checked personas (PRODUCT.md "Tax engine") — independent oracle.
 *
 * Expected values are my own hand computations from primary sources (work shown below); they were NOT
 * copied from running the engine, and src/constants/ was not read.
 *
 * 2026 constants used:
 *  - Brackets, standard deduction: Form 1040-ES (2026) Tax Rate Schedules + std-deduction chart,
 *    https://www.irs.gov/pub/irs-pdf/f1040es.pdf ; Rev. Proc. 2025-32 https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
 *      Single: 10% ≤12,400 | 12% ≤50,400 | 22% ≤105,700 | 24% ≤201,775 | 32% ≤256,225 | 35% ≤640,600 | 37%
 *      MFJ:    10% ≤24,800 | 12% ≤100,800 | 22% ≤211,400 | 24% ≤403,550 | ...
 *      Std deduction: single 16,100; MFJ 32,200
 *  - SS wage base 184,500 (Form 1040-ES 2026 SE worksheet line 5; SSA https://www.ssa.gov/oact/cola/cbb.html)
 *  - QBI threshold 2026: 201,750 single / 403,500 MFJ (Rev. Proc. 2025-32 §4.26) — all personas below it.
 *  - Safe harbor 90 / 100 / 110 (> $150,000 prior AGI), Form 1040-ES 2026.
 *  - Schedule AI line logic: Form 2210 (2025) https://www.irs.gov/pub/irs-pdf/f2210.pdf (2026 form not yet
 *    published); prorated SS limits 2026 = 184,500 × 3/12, 5/12, 8/12, 1 = 46,125 / 76,875 / 123,000 / 184,500.
 *  - North Carolina (flat-state persona): 2026 rate 3.99% — NCDOR "Tax Rate Schedules"
 *    https://www.ncdor.gov/taxes-forms/individual-income-tax/tax-rate-schedules ("For Taxable Years after 2025 ...
 *    3.99%"). NC standard deduction single $12,750 — NCDOR page
 *    https://www.ncdor.gov/taxes-forms/individual-income-tax/north-carolina-standard-deduction-or-north-carolina-itemized-deductions
 *    states it for TY2025; it is a fixed statutory amount (G.S. 105-153.5), assumed unchanged for 2026
 *    (NOT separately confirmed for 2026). NC base = federal AGI (NC does not allow the QBI deduction).
 *
 * Tolerance: direct engine outputs toBeCloseTo(x, 2) (cent rounding of my exact figure); state tax and
 * sums of separately rounded outputs within ±$1 / ±$0.02 as noted.
 *
 * ---- Base persona: single designer, net 1099 $60,000 (used throughout) ----
 *   SE:  60,000 × 0.9235 = 55,410.00
 *        SS 55,410 × 0.124 = 6,870.84 ; Medicare 55,410 × 0.029 = 1,606.89 ; SE tax = 8,477.73
 *        deduction ½ = 4,238.865
 *   AGI = 60,000 − 4,238.865 = 55,761.135
 *   taxable before QBI = 55,761.135 − 16,100 = 39,661.135
 *   QBI = 60,000 − 4,238.865 = 55,761.135 → 20% = 11,152.227; limit 20% × 39,661.135 = 7,932.227 → 7,932.227
 *   taxable = 39,661.135 − 7,932.227 = 31,728.908
 *   income tax = 1,240 + 12% × (31,728.908 − 12,400) = 1,240 + 2,319.46896 = 3,559.46896
 *   federalTotal = 3,559.46896 + 8,477.73 = 12,037.19896 ; 90% = 10,833.47906
 */
import { describe, expect, it } from "vitest";
import { estimate, annualized, setAsideForPayment, toICS } from "../index";

const near = (actual: number, expected: number, tol = 0.02) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
const hasFlag = (r: { flags: { code: string }[] }, code: string) => r.flags.some((f) => f.code === code);

const designer = {
  filingStatus: "single" as const,
  state: "TX" as const,
  asOf: "2026-03-01",
  expectedAnnual1099Income: 60000,
};

describe("Persona: single designer, $60k net 1099", () => {
  it("Texas (no income tax): full federal breakdown", () => {
    const r = estimate({ ...designer, priorYearTax: null });
    expect(r.tax.seSocialSecurity).toBeCloseTo(6870.84, 2);
    expect(r.tax.seMedicare).toBeCloseTo(1606.89, 2);
    expect(r.tax.seTax).toBeCloseTo(8477.73, 2);
    expect(r.tax.additionalMedicare).toBeCloseTo(0, 2);
    near(r.tax.seDeduction, 4238.865, 0.01);
    near(r.income.agi, 55761.135, 0.01);
    expect(r.income.standardDeduction).toBeCloseTo(16100, 2);
    near(r.income.qbiDeduction, 7932.227, 0.01);
    near(r.income.taxableIncome, 31728.908, 0.01);
    near(r.tax.federalIncomeTax, 3559.469, 0.01);
    expect(r.tax.federalTotal).toBeCloseTo(12037.2, 2);
    expect(r.tax.state).toBe(0);
    expect(r.tax.stateMethod).toBe("none");
    expect(r.rates.marginalFederal).toBeCloseTo(0.12, 4);
    // effectiveOnFreelance = (12,037.19896 + 0 − 0) / 60,000 = 0.2006200
    expect(r.rates.effectiveOnFreelance).toBeCloseTo(0.2006, 3);
    expect(hasFlag(r, "credits_not_modeled")).toBe(true);
  });

  it("North Carolina (flat 3.99%): state = 3.99% × (federal AGI − 12,750)", () => {
    // 0.0399 × (55,761.135 − 12,750) = 0.0399 × 43,011.135 = 1,716.144
    const r = estimate({ ...designer, state: "NC", priorYearTax: null });
    expect(r.tax.stateMethod).toBe("flat");
    near(r.tax.state, 1716.14, 1);
    expect(r.tax.federalTotal).toBeCloseTo(12037.2, 2); // federal unaffected by state
    near(r.tax.total, 12037.2 + 1716.14, 1);
  });

  it("prior-year tax unknown → 90% of current year, priorYearOption null, flag prior_year_unknown", () => {
    // RAP = 0.9 × 12,037.19896 = 10,833.47906; per quarter 2,708.36977
    const r = estimate({ ...designer, priorYearTax: null, priorYearAgi: null });
    expect(r.safeHarbor.rule).toBe("current90");
    expect(r.safeHarbor.priorYearOption).toBeNull();
    expect(r.safeHarbor.currentYearOption).toBeCloseTo(10833.48, 2);
    expect(r.safeHarbor.requiredAnnualPayment).toBeCloseTo(10833.48, 2);
    for (const i of r.installments) expect(i.required).toBeCloseTo(2708.37, 2);
    expect(hasFlag(r, "prior_year_unknown")).toBe(true);
    // asOf 2026-03-01 → next deadline Q1 2026-04-15, nothing paid: 2,708.37
    expect(r.nextDeadline?.quarter).toBe(1);
    expect(r.nextDeadline?.due).toBe("2026-04-15");
    expect(r.nextDeadline?.amountDue).toBeCloseTo(2708.37, 2);
  });

  it("set-aside: steady rate = freelance tax / annual freelance income; catch-up = remaining liability / remaining income", () => {
    // ytd 30,000 of 60,000; no payments, no withholding, TX:
    // catchUpRate = 12,037.19896 / (60,000 − 30,000) = 0.401240 → 0.4012 (4 decimals); within the [0, 0.6] clamp
    // rate: no W-2 wages and no state tax, so the same return without 1099 income owes 0 and
    //   freelanceTax = 12,037.19896 − 0 = 12,037.19896; rate = 12,037.19896 / 60,000 = 0.200620 → 0.2006
    const r = estimate({ ...designer, asOf: "2026-07-01", ytd1099Income: 30000, priorYearTax: null });
    expect(r.income.projected).toBe(false);
    expect(r.setAside.catchUpRate).toBeCloseTo(0.4012, 4);
    expect(r.setAside.rate).toBeCloseTo(0.2006, 4);
    const s = setAsideForPayment(r, 1000);
    near(s.setAside, 200.6, 0.05); // 1,000 × 0.2006 (setAsideForPayment uses the steady rate)
  });
});

describe("Persona: estimated payments made reduce what is due next", () => {
  // designer with prior-year tax 8,000 (AGI 50,000 ≤ 150k → 100%): RAP = min(10,833.48, 8,000) = 8,000;
  // 2,000 per quarter. asOf 2026-07-01 → next deadline Q3 (2026-09-15).
  const base = { ...designer, asOf: "2026-07-01", priorYearTax: 8000, priorYearAgi: 50000 };

  it("two on-time 2,000 payments → Q3 amountDue = 6,000 − 4,000 = 2,000; true-up = 4,037.20", () => {
    const r = estimate({
      ...base,
      estimatedPaymentsMade: [
        { date: "2026-04-10", amount: 2000 },
        { date: "2026-06-12", amount: 2000 },
      ],
    });
    expect(r.safeHarbor.rule).toBe("prior100");
    expect(r.safeHarbor.requiredAnnualPayment).toBeCloseTo(8000, 2);
    expect(r.nextDeadline?.quarter).toBe(3);
    expect(r.nextDeadline?.due).toBe("2026-09-15");
    expect(r.nextDeadline?.amountDue).toBeCloseTo(2000, 2);
    expect(r.nextDeadline?.includesPastDue).toBe(false);
    // aprilTrueUp = 12,037.19896 − 0 − (4,000 paid + 2,000 Q3 + 2,000 Q4 remaining) = 4,037.19896
    near(r.aprilTrueUp, 4037.2, 0.01);
  });

  it("overpaying (10,000 in April) → amountDue 0, never negative; no instalment shortfall", () => {
    // cumulative required thru Q3 = 6,000; paid 10,000 → max(0, 6,000 − 10,000) = 0
    const r = estimate({ ...base, estimatedPaymentsMade: [{ date: "2026-04-10", amount: 10000 }] });
    expect(r.nextDeadline?.quarter).toBe(3);
    expect(r.nextDeadline?.amountDue).toBe(0);
    for (const i of r.installments) expect(i.shortfall).toBeGreaterThanOrEqual(0);
    expect(r.installments[0]!.shortfall).toBe(0);
    expect(r.installments[2]!.shortfall).toBe(0);
  });

  it("ICS: one all-day event per remaining instalment (Q3, Q4), RFC 5545 basics", () => {
    const r = estimate({
      ...base,
      estimatedPaymentsMade: [
        { date: "2026-04-10", amount: 2000 },
        { date: "2026-06-12", amount: 2000 },
      ],
    });
    const ics = toICS(r);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("UID:penaltyproof-2026-q3@penaltyproof");
    expect(ics).toContain("UID:penaltyproof-2026-q4@penaltyproof");
    expect(ics).not.toContain("UID:penaltyproof-2026-q1@penaltyproof"); // due 2026-04-15 < asOf
    expect(ics).toContain("DTSTART;VALUE=DATE:20260915");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270115");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    // no bare LF, every line ≤ 75 octets
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("Persona: MFJ, W-2 job $85k wages / $8k withholding + $25k side income", () => {
  // SE: 25,000 × 0.9235 = 23,087.50; SS base room 184,500 − 85,000 = 99,500 > 23,087.50
  //   SS 23,087.50 × 0.124 = 2,862.85; Medicare × 0.029 = 669.5375; SE tax 3,532.3875; ded 1,766.19375
  // AGI = 85,000 + 25,000 − 1,766.19375 = 108,233.80625
  // pre-QBI taxable = 108,233.80625 − 32,200 = 76,033.80625
  // QBI = 25,000 − 1,766.19375 = 23,233.80625 × 20% = 4,646.76125 (< 20% × 76,033.81 = 15,206.76)
  // taxable = 71,387.045 ; tax = 2,480 + 12% × (71,387.045 − 24,800) = 2,480 + 5,590.4454 = 8,070.4454
  // federalTotal = 8,070.4454 + 3,532.3875 = 11,602.8329 ; − withholding 8,000 = 3,602.83 ≥ 1,000 → required
  // prior-year tax 10,000, AGI 100,000 → prior100 = 10,000 < 90% current 10,442.55 → RAP 10,000; 2,500/qtr
  // withholding treated as paid 8,000/4 = 2,000 on each due date (i2210 line 19 default)
  it("breakdown, safe harbor, withholding credit and next deadline with a past-due Q1", () => {
    const r = estimate({
      filingStatus: "mfj", state: "TX", asOf: "2026-05-01",
      w2Wages: 85000, w2Withholding: 8000, expectedAnnual1099Income: 25000,
      priorYearTax: 10000, priorYearAgi: 100000,
    });
    expect(r.tax.seSocialSecurity).toBeCloseTo(2862.85, 2);
    expect(r.tax.seMedicare).toBeCloseTo(669.54, 2);
    expect(r.tax.seTax).toBeCloseTo(3532.39, 2);
    near(r.income.agi, 108233.81, 0.01);
    near(r.income.qbiDeduction, 4646.76, 0.01);
    near(r.income.taxableIncome, 71387.05, 0.01);
    near(r.tax.federalIncomeTax, 8070.45, 0.01);
    expect(r.tax.federalTotal).toBeCloseTo(11602.83, 2);
    expect(r.rates.marginalFederal).toBeCloseTo(0.12, 4);
    expect(r.safeHarbor.currentYearOption).toBeCloseTo(10442.55, 2);
    expect(r.safeHarbor.priorYearOption).toBeCloseTo(10000, 2);
    expect(r.safeHarbor.rule).toBe("prior100");
    expect(r.safeHarbor.requiredAnnualPayment).toBeCloseTo(10000, 2);
    expect(r.installments.map((i) => i.required)).toEqual([2500, 2500, 2500, 2500]);
    expect(r.installments.map((i) => i.withholdingCredited)).toEqual([2000, 2000, 2000, 2000]);
    // Q1 (2026-04-15) passed: 2,500 − 2,000 = 500 short → past due
    expect(r.installments[0]!.shortfall).toBeCloseTo(500, 2);
    // next = Q2 2026-06-15: cumulative 5,000 − withholding 4,000 − payments 0 = 1,000 (includes Q1's 500)
    expect(r.nextDeadline?.quarter).toBe(2);
    expect(r.nextDeadline?.amountDue).toBeCloseTo(1000, 2);
    expect(r.nextDeadline?.includesPastDue).toBe(true);
    expect(hasFlag(r, "past_due_installment")).toBe(true);
  });
});

describe("Persona: high earner, prior-year AGI > $150k → 110% rule wins", () => {
  // single, TX, net 1099 200,000:
  //   net earnings 184,700; SS = min(184,700, 184,500) × 0.124 = 22,878.00; Medicare 184,700 × 0.029 = 5,356.30
  //   SE tax 28,234.30; Additional Medicare: 184,700 < 200,000 → 0; ded 14,117.15
  //   AGI 185,882.85; pre-QBI taxable 169,782.85 (< 201,750 threshold → full simplified QBI)
  //   QBI 20% × 185,882.85 = 37,176.57 > 20% × 169,782.85 = 33,956.57 → 33,956.57
  //   taxable 135,826.28; tax = 17,966 + 24% × 30,126.28 = 25,196.3072
  //   federalTotal = 53,430.6072; 90% = 48,087.5465
  // prior tax 40,000, AGI 180,000 > 150,000 → 110% = 44,000 < 48,087.55 → prior110, RAP 44,000, 11,000/qtr
  it("prior110 with SS wage base reached", () => {
    const r = estimate({
      filingStatus: "single", state: "TX", asOf: "2026-03-01",
      expectedAnnual1099Income: 200000, priorYearTax: 40000, priorYearAgi: 180000,
    });
    expect(r.tax.seSocialSecurity).toBeCloseTo(22878.0, 2);
    expect(r.tax.seMedicare).toBeCloseTo(5356.3, 2);
    expect(r.tax.additionalMedicare).toBeCloseTo(0, 2);
    near(r.income.qbiDeduction, 33956.57, 0.01);
    near(r.tax.federalIncomeTax, 25196.31, 0.01);
    expect(r.tax.federalTotal).toBeCloseTo(53430.61, 2);
    expect(r.rates.marginalFederal).toBeCloseTo(0.24, 4);
    expect(r.safeHarbor.currentYearOption).toBeCloseTo(48087.55, 2);
    expect(r.safeHarbor.priorYearOption).toBeCloseTo(44000, 2);
    expect(r.safeHarbor.rule).toBe("prior110");
    expect(r.safeHarbor.requiredAnnualPayment).toBeCloseTo(44000, 2);
    for (const i of r.installments) expect(i.required).toBeCloseTo(11000, 2);
    expect(hasFlag(r, "ss_wage_base_reached")).toBe(true);
    expect(hasFlag(r, "qbi_above_threshold")).toBe(false);
  });
});

describe("Persona: rideshare driver with lumpy Q4 income (Schedule AI)", () => {
  // single, TX, prior-year unknown. Payments: 02-15 3,000; 10-15 12,000; 11-15 15,000; 12-15 20,000 = 50,000.
  // asOf 2026-12-31 so all income is received (no YTD extrapolation).
  // Full year: net earnings 46,175; SE 46,175 × 0.153 = 7,064.775; ded 3,532.3875; AGI 46,467.6125;
  //   pre-QBI 30,367.6125; QBI 20% × 30,367.6125 = 6,073.5225; taxable 24,294.09;
  //   tax 1,240 + 12% × 11,894.09 = 2,667.2908; T = 9,732.0658; RAP = 90% T = 8,758.85922; regular 2,189.7148
  // Schedule AI (Form 2210 lines 1–36), cumulative income 3,000 / 3,000 / 3,000 / 50,000:
  //  (a) line 28 = 2,770.50; l33 = 0.496 × 2,770.50 = 1,374.168; l35 = 0.116 × 2,770.50 = 321.378; l36 = 1,695.546
  //      AGI annualized 12,000 − 847.773 = 11,152.23 < 16,100 → income tax 0; l19 = 1,695.546
  //      l21 = 22.5% → 381.4978; l23 = 381.4978; l26 = 2,189.7148 → l27 = 381.4978
  //  (b) l33 = 0.2976 × 2,770.50 = 824.5008; l35 = 0.0696 × 2,770.50 = 192.8268; l36 = 1,017.3276; tax 0
  //      l21 = 45% → 457.7974; l22 = 381.4978; l23 = 76.2996; l26 = 2,189.7148 + (2,189.7148 − 381.4978) = 3,997.9318
  //      l27 = 76.2996
  //  (c) l33 = 0.186 × 2,770.50 = 515.313; l35 = 0.0435 × 2,770.50 = 120.5168; l36 = 635.8298; tax 0
  //      l21 = 67.5% → 429.1851; l22 = 457.7974 → l23 = 0; l27 = 0 (l26 = 2,189.7148 + 3,921.6322 = 6,111.3470)
  //  (d) l19 = T = 9,732.0658; l21 = 90% → 8,758.8592; l22 = 457.7974 → l23 = 8,301.0618;
  //      l26 = 2,189.7148 + 6,111.3470 = 8,301.0618 → l27 = 8,301.0618
  //  total = 381.4978 + 76.2996 + 0 + 8,301.0618 = 8,758.8592 = RAP
  const driver = {
    filingStatus: "single" as const, state: "TX" as const, asOf: "2026-12-31", priorYearTax: null,
    payments1099: [
      { date: "2026-02-15", amount: 3000 },
      { date: "2026-10-15", amount: 12000 },
      { date: "2026-11-15", amount: 15000 },
      { date: "2026-12-15", amount: 20000 },
    ],
  };

  it("regular method: 25% of 90% × 9,732.07 = 2,189.71 per quarter", () => {
    const r = estimate(driver);
    expect(r.tax.federalTotal).toBeCloseTo(9732.07, 2);
    expect(r.safeHarbor.requiredAnnualPayment).toBeCloseTo(8758.86, 2);
    for (const i of r.installments) expect(i.required).toBeCloseTo(2189.71, 2);
  });

  it("annualized(): early instalments far lower (381.50 / 76.30 / 0), Q4 8,301.06, same total", () => {
    const a = annualized(driver);
    const req = a.installments.map((i) => i.required);
    expect(req[0]).toBeCloseTo(381.5, 2);
    expect(req[1]).toBeCloseTo(76.3, 2);
    expect(req[2]).toBeCloseTo(0, 2);
    expect(req[3]).toBeCloseTo(8301.06, 2);
    expect(a.installments[0]!.regularInstallment).toBeCloseTo(2189.71, 2);
    expect(a.installments[1]!.regularInstallment).toBeCloseTo(3997.93, 2);
    near(a.totalRequired, 8758.86);
    // each of Q1–Q3 is below the regular 2,189.71
    for (const q of [0, 1, 2]) expect(req[q]!).toBeLessThan(2189.71);
  });
});
