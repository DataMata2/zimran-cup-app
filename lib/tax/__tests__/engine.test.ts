// Unit tests for the engine's building blocks and invariants.
// Expected values come from the 2026 constants (Rev. Proc. 2025-32, SSA, Form 1040-ES 2026) and are worked
// out by hand in the comments; tests that depend on a state's rule read the rule's parameters from
// src/constants/states2026.ts and recompute the tax independently.

import { describe, expect, it } from "vitest";
import { ADDITIONAL_MEDICARE, BRACKETS, QBI, SE, type Bracket } from "../constants/federal2026";
import { STATES, type StateCode } from "../constants/states2026";
import { bracketTax, marginalRate, qbiDeduction } from "../federal";
import { foldLine } from "../ics";
import { round2 } from "../money";
import { annualized, estimate, setAsideForPayment, TaxInputError, toICS, type TaxInput } from "../index";

const hasFlag = (r: { flags: { code: string }[] }, code: string) => r.flags.some((f) => f.code === code);
const base: TaxInput = { filingStatus: "single", state: "TX", asOf: "2026-03-01", expectedAnnual1099Income: 60000 };

describe("money", () => {
  it("round2 rounds half away from zero, absorbs binary noise, never returns -0", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
    expect(Object.is(round2(-0.001), 0)).toBe(true);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("federal brackets", () => {
  it("bracket math at the boundaries (single 2026)", () => {
    const single = BRACKETS.single;
    expect(bracketTax(0, single)).toBe(0);
    expect(bracketTax(-5, single)).toBe(0);
    expect(bracketTax(12400, single)).toBeCloseTo(1240, 9); // 10% × 12,400
    expect(bracketTax(12401, single)).toBeCloseTo(1240.12, 9); // first dollar at 12%
    expect(bracketTax(50400, single)).toBeCloseTo(5800, 9); // 1,240 + 12% × 38,000
    expect(bracketTax(105700, single)).toBeCloseTo(5800 + 0.22 * 55300, 9); // 17,966
    expect(bracketTax(1_000_000, single)).toBeCloseTo(
      17966 + 0.24 * (201775 - 105700) + 0.32 * (256225 - 201775) + 0.35 * (640600 - 256225) + 0.37 * (1_000_000 - 640600),
      6,
    );
    // Marginal rate = rate on the next dollar: at an exact bracket top it is the upper rate.
    expect(marginalRate(12399.99, single)).toBe(0.1);
    expect(marginalRate(12400, single)).toBe(0.12);
    expect(marginalRate(0, single)).toBe(0.1);
    expect(marginalRate(5_000_000, single)).toBe(0.37);
  });

  it("bracketTax works on any ascending schedule", () => {
    const toy: Bracket[] = [
      { upTo: 100, rate: 0.1 },
      { upTo: 200, rate: 0.2 },
      { upTo: null, rate: 0.5 },
    ];
    expect(bracketTax(100, toy)).toBeCloseTo(10, 9);
    expect(bracketTax(150, toy)).toBeCloseTo(20, 9);
    expect(bracketTax(300, toy)).toBeCloseTo(80, 9);
  });
});

describe("self-employment tax", () => {
  it("$400 floor on net earnings (Schedule SE line 4c)", () => {
    // 433.13 × 0.9235 = 399.9956 < 400 → 0; 433.14 × 0.9235 = 400.0048 → (12.4% + 2.9%) × 400.0048
    const below = estimate({ ...base, expectedAnnual1099Income: 433.13 });
    expect(below.tax.seTax).toBe(0);
    expect(below.tax.seDeduction).toBe(0);
    const above = estimate({ ...base, expectedAnnual1099Income: 433.14 });
    expect(above.tax.seTax).toBeCloseTo(433.14 * SE.netEarningsFactor * (SE.ssRate + SE.medicareRate), 2);
  });

  it("Social Security part capped at the wage base reduced by the freelancer's W-2 wages", () => {
    // Wages 150,000 → room 34,500. Net profit 100,000 → net earnings 92,350 → SS = 12.4% × 34,500 = 4,278.
    const r = estimate({ ...base, expectedAnnual1099Income: 100000, w2Wages: 150000, w2Withholding: 30000 });
    expect(r.tax.seSocialSecurity).toBeCloseTo(0.124 * (184500 - 150000), 2);
    expect(r.tax.seMedicare).toBeCloseTo(0.029 * 92350, 2);
    expect(hasFlag(r, "ss_wage_base_reached")).toBe(true);
    // Same household wages earned by a spouse: no reduction of the freelancer's base.
    const spouse = estimate({ ...base, filingStatus: "mfj", expectedAnnual1099Income: 100000, w2Wages: 150000, w2WagesOfFreelancer: 0 });
    expect(spouse.tax.seSocialSecurity).toBeCloseTo(0.124 * 92350, 2);
    expect(hasFlag(spouse, "ss_wage_base_reached")).toBe(false);
    // Wages above the base → SS part 0, Medicare still due.
    const over = estimate({ ...base, expectedAnnual1099Income: 10000, w2Wages: SE.ssWageBase + 1 });
    expect(over.tax.seSocialSecurity).toBe(0);
    expect(over.tax.seMedicare).toBeCloseTo(0.029 * 9235, 2);
  });

  it("Additional Medicare: wages over the threshold plus SE earnings over the reduced threshold", () => {
    // single, wages 250,000: wages part 0.9% × 50,000 = 450; SE threshold reduced to 0 → 0.9% × 92,350 = 831.15
    const r = estimate({ ...base, expectedAnnual1099Income: 100000, w2Wages: 250000, w2Withholding: 60000 });
    expect(r.tax.additionalMedicare).toBeCloseTo(450 + 831.15, 2);
    expect(hasFlag(r, "additional_medicare_applies")).toBe(true);
    // MFJ threshold 250,000, wages 100,000 → SE threshold 150,000; net earnings 184,700 → 0.9% × 34,700 = 312.30
    const mfj = estimate({ ...base, filingStatus: "mfj", expectedAnnual1099Income: 200000, w2Wages: 100000, w2WagesOfFreelancer: 0 });
    expect(ADDITIONAL_MEDICARE.threshold.mfj).toBe(250000);
    expect(mfj.tax.additionalMedicare).toBeCloseTo(312.3, 2);
    // Additional Medicare is not part of seTax and not in the SE deduction.
    expect(mfj.tax.seDeduction).toBeCloseTo(mfj.tax.seTax / 2, 2);
  });
});

describe("QBI deduction (simplified)", () => {
  const t = QBI.threshold.single;
  const range = QBI.phaseInRange.single;

  it("below the threshold: 20% of the smaller of QBI and taxable income", () => {
    expect(qbiDeduction(50000, 100000, "single")).toEqual({ deduction: 10000, zone: "below" });
    expect(qbiDeduction(50000, 30000, "single")).toEqual({ deduction: 6000, zone: "below" });
    expect(qbiDeduction(50000, t, "single").zone).toBe("below"); // at the threshold: no reduction
  });

  it("inside the phase-in range: SSTB formula 20% × QBI × (1 − p)²; above it: 0", () => {
    const mid = qbiDeduction(100000, t + range / 2, "single");
    expect(mid.zone).toBe("phaseIn");
    expect(mid.deduction).toBeCloseTo(0.2 * 100000 * 0.5 * 0.5, 6);
    const quarter = qbiDeduction(100000, t + range / 4, "single");
    expect(quarter.deduction).toBeCloseTo(0.2 * 100000 * 0.75 * 0.75, 6);
    expect(qbiDeduction(100000, t + range, "single")).toEqual({ deduction: 0, zone: "above" });
    expect(qbiDeduction(-1000, 50000, "single").deduction).toBe(0);
  });

  it("estimate() flags phase-in and above-threshold zones", () => {
    const phase = estimate({ ...base, expectedAnnual1099Income: 260000 });
    expect(hasFlag(phase, "qbi_phase_in")).toBe(true);
    const above = estimate({ ...base, expectedAnnual1099Income: 400000 });
    expect(hasFlag(above, "qbi_above_threshold")).toBe(true);
    expect(above.income.qbiDeduction).toBe(0);
  });
});

describe("safe harbor rule selection", () => {
  // Designer (single, net 60,000): federalTotal 12,037.19896 → 90% = 10,833.48.
  it("current90 when prior-year tax is higher or unknown; prior100 when lower", () => {
    expect(estimate({ ...base, priorYearTax: 20000, priorYearAgi: 50000 }).safeHarbor.rule).toBe("current90");
    const unknown = estimate(base);
    expect(unknown.safeHarbor.rule).toBe("current90");
    expect(hasFlag(unknown, "prior_year_unknown")).toBe(true);
    const p = estimate({ ...base, priorYearTax: 9000, priorYearAgi: 50000 });
    expect(p.safeHarbor.rule).toBe("prior100");
    expect(p.safeHarbor.requiredAnnualPayment).toBe(9000);
  });

  it("prior110 just over $150,000 AGI; MFS uses $75,000", () => {
    expect(estimate({ ...base, priorYearTax: 9000, priorYearAgi: 150000 }).safeHarbor.rule).toBe("prior100");
    const hi = estimate({ ...base, priorYearTax: 9000, priorYearAgi: 150000.01 });
    expect(hi.safeHarbor.rule).toBe("prior110");
    expect(hi.safeHarbor.requiredAnnualPayment).toBeCloseTo(9900, 2);
    const mfs = { ...base, filingStatus: "mfs" as const, priorYearTax: 9000 };
    expect(estimate({ ...mfs, priorYearAgi: 75000 }).safeHarbor.rule).toBe("prior100");
    expect(estimate({ ...mfs, priorYearAgi: 75001 }).safeHarbor.rule).toBe("prior110");
    // 110% can push the prior option above 90% current: then current90 wins.
    expect(estimate({ ...base, priorYearTax: 10000, priorYearAgi: 200000 }).safeHarbor.rule).toBe("current90");
  });

  it("noneRequired when under $1,000 after withholding, or prior-year tax was 0 for a full year", () => {
    const small = estimate({ ...base, expectedAnnual1099Income: 5000 });
    expect(small.safeHarbor.rule).toBe("noneRequired");
    expect(small.safeHarbor.requiredAnnualPayment).toBe(0);
    expect(small.nextDeadline?.amountDue).toBe(0);
    expect(hasFlag(small, "no_estimates_required")).toBe(true);
    // Withholding covers all but $999.99 → none required.
    const fullyWithheld = estimate({ ...base, w2Withholding: 12037.2 - 999.99 });
    expect(fullyWithheld.safeHarbor.rule).toBe("noneRequired");
    const zeroPrior = estimate({ ...base, priorYearTax: 0, priorYearAgi: 0 });
    expect(zeroPrior.safeHarbor.rule).toBe("noneRequired");
    expect(zeroPrior.installments.every((i) => i.status === "paid")).toBe(true);
  });
});

describe("schedule: next deadline, crediting, past due", () => {
  it("next-deadline amount is never negative over a grid of inputs (incl. overpayment)", () => {
    const dates = ["2026-01-10", "2026-04-15", "2026-04-16", "2026-08-01", "2026-12-31", "2027-01-15"];
    for (const asOf of dates)
      for (const income of [0, 3000, 60000, 250000])
        for (const withholding of [0, 5000, 80000])
          for (const paid of [0, 1000, 20000, 200000]) {
            const r = estimate({
              ...base,
              asOf,
              expectedAnnual1099Income: income,
              w2Wages: withholding * 4,
              w2Withholding: withholding,
              priorYearTax: income / 5,
              priorYearAgi: income,
              estimatedPaymentsMade: paid ? [{ date: "2026-04-01", amount: paid }] : [],
            });
            expect(r.nextDeadline).not.toBeNull();
            expect(r.nextDeadline!.amountDue).toBeGreaterThanOrEqual(0);
            for (const i of r.installments) {
              expect(i.shortfall).toBeGreaterThanOrEqual(0);
              expect(i.plannedPayment).toBeGreaterThanOrEqual(0);
            }
            expect(r.progress.pct).toBeGreaterThanOrEqual(0);
            expect(r.progress.pct).toBeLessThanOrEqual(100);
          }
  });

  it("payments made reduce the next deadline amount dollar for dollar until it reaches 0", () => {
    const at = (paid: number) =>
      estimate({ ...base, asOf: "2026-08-01", estimatedPaymentsMade: paid ? [{ date: "2026-05-01", amount: paid }] : [] })
        .nextDeadline!.amountDue;
    const none = at(0); // Q3: 3 × 2,708.37 = 8,125.11
    expect(none).toBeCloseTo(3 * 0.25 * 0.9 * 12037.19896, 2);
    expect(at(1000)).toBeCloseTo(none - 1000, 2);
    expect(at(5000)).toBeCloseTo(none - 5000, 2);
    expect(at(50000)).toBe(0);
  });

  it("a late payment is credited to the earliest unpaid instalment; an earlier miss is flagged past due", () => {
    // RAP 8,000 (prior100) → 2,000/qtr. asOf 2026-07-01, one 3,000 payment on 2026-05-01 (after Q1 due).
    const r = estimate({ ...base, asOf: "2026-07-01", priorYearTax: 8000, priorYearAgi: 50000, estimatedPaymentsMade: [{ date: "2026-05-01", amount: 3000 }] });
    expect(r.installments.map((i) => i.paymentsCredited)).toEqual([2000, 1000, 0, 0]);
    expect(r.installments.map((i) => i.status)).toEqual(["paid", "pastDue", "due", "upcoming"]);
    expect(r.installments[1]!.shortfall).toBe(1000);
    expect(r.nextDeadline).toEqual({ quarter: 3, due: "2026-09-15", amountDue: 3000, includesPastDue: true });
    expect(hasFlag(r, "past_due_installment")).toBe(true);
    // Planned payments: Q3 3,000 (incl. Q2's 1,000), Q4 2,000; true-up = 12,037.20 − 3,000 − 5,000.
    expect(r.installments.map((i) => i.plannedPayment)).toEqual([0, 0, 3000, 2000]);
    expect(r.aprilTrueUp).toBeCloseTo(12037.2 - 8000, 2);
    // An overpayment carries forward: 5,000 on 2026-04-01 covers Q1, Q2 and half of Q3.
    const over = estimate({ ...base, asOf: "2026-07-01", priorYearTax: 8000, priorYearAgi: 50000, estimatedPaymentsMade: [{ date: "2026-04-01", amount: 5000 }] });
    expect(over.installments.map((i) => i.paymentsCredited)).toEqual([2000, 2000, 1000, 0]);
    expect(over.nextDeadline!.amountDue).toBe(1000);
    expect(hasFlag(over, "past_due_installment")).toBe(false);
  });
});

describe("set-aside", () => {
  it("rate is the steady freelance rate; catchUpRate is remaining-based; both clamped to [0, 0.6]", () => {
    // Late in the year with nothing paid: 12,037 owed on 6,000 still to come → catch-up clamped to 0.6,
    // while the steady rate stays 12,037.19896 / 60,000 = 0.2006.
    const late = estimate({ ...base, asOf: "2026-11-30", ytd1099Income: 54000 });
    expect(late.setAside.catchUpRate).toBe(0.6);
    expect(late.setAside.rate).toBe(0.2006);
    expect(setAsideForPayment(late, 1234.56)).toEqual({ amount: 1234.56, setAside: 247.65, rate: 0.2006 });
    // Everything already paid → catch-up 0; the steady rate is unchanged.
    const paid = estimate({ ...base, estimatedPaymentsMade: [{ date: "2026-02-01", amount: 20000 }] });
    expect(paid.setAside.catchUpRate).toBe(0);
    expect(paid.setAside.rate).toBe(0.2006);
    // A freelance loss → both 0 (lower clamp).
    const loss = estimate({ ...base, businessExpenses: 70000 });
    expect(loss.setAside.rate).toBe(0);
    expect(loss.setAside.catchUpRate).toBe(0);
    // Negative payment amounts set nothing aside.
    expect(setAsideForPayment(late, -10).setAside).toBe(0);
  });
});

describe("income", () => {
  it("projects the full year from YTD when no expected amount is given", () => {
    // 2026-07-02 is day 183 of 365 → 18,300 / (183/365) = 36,500
    const r = estimate({ filingStatus: "single", state: "TX", asOf: "2026-07-02", ytd1099Income: 18300 });
    expect(r.income.projected).toBe(true);
    expect(r.income.net1099Annual).toBeCloseTo(36500, 2);
    expect(r.income.net1099Ytd).toBe(18300);
    expect(hasFlag(r, "income_projected")).toBe(true);
    // Dated payments replace ytd1099Income; only those dated on/before asOf count as YTD.
    const p = estimate({
      filingStatus: "single", state: "TX", asOf: "2026-07-02", ytd1099Income: 999999, expectedAnnual1099Income: 40000,
      payments1099: [{ date: "2026-02-01", amount: 10000 }, { date: "2026-06-30", amount: 8300 }, { date: "2026-09-01", amount: 5000 }],
    });
    expect(p.income.net1099Ytd).toBe(18300);
    expect(p.income.net1099Annual).toBe(40000);
    expect(p.income.projected).toBe(false);
  });

  it("results are plain JSON and the input echo has every key", () => {
    const r = estimate({ ...base, estimatedPaymentsMade: [{ date: "2026-04-01", amount: 100 }] });
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    expect(Object.values(r.input).every((v) => v !== undefined)).toBe(true);
    const a = annualized(base);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it("rejects invalid input", () => {
    expect(() => estimate({ ...base, asOf: "2026-02-30" })).toThrow();
    expect(() => estimate({ ...base, w2Wages: -1 })).toThrow();
    expect(() => estimate({ ...base, filingStatus: "joint" as never })).toThrow();
    expect(() => estimate({ ...base, state: "XX" as never })).toThrow();
  });
});

describe("state tax", () => {
  const codes = Object.keys(STATES) as StateCode[];
  const firstOf = (kind: string) => codes.find((c) => STATES[c].kind === kind);
  // Designer federal AGI 55,761.135, taxable income 31,728.908.
  const agi = 55761.135;
  const taxable = 31728.908;

  it("no-income-tax state → 0", () => {
    const r = estimate({ ...base, state: "TX" });
    expect(r.tax.stateMethod).toBe("none");
    expect(r.tax.state).toBe(0);
    expect(hasFlag(r, "state_estimates_not_scheduled")).toBe(false);
  });

  it("flat state = rate × (base − deduction)", () => {
    const code = firstOf("flat");
    expect(code).toBeDefined();
    const rule = STATES[code!];
    if (rule.kind !== "flat") throw new Error("unreachable");
    const b = rule.base === "federalTaxable" ? taxable : agi;
    const r = estimate({ ...base, state: code! });
    expect(r.tax.stateMethod).toBe("flat");
    expect(r.tax.state).toBeCloseTo(Math.max(0, b - rule.deduction.single) * rule.rate, 1);
    expect(hasFlag(r, "state_estimates_not_scheduled")).toBe(r.tax.state > 0);
  });

  it("bracket state (CA) = progressive tax on AGI − deduction", () => {
    const rule = STATES.CA;
    expect(rule.kind).toBe("brackets");
    if (rule.kind !== "brackets") throw new Error("unreachable");
    const r = estimate({ ...base, state: "CA" });
    expect(r.tax.stateMethod).toBe("brackets");
    expect(r.tax.state).toBeCloseTo(bracketTax(agi - rule.deduction.single, rule.brackets.single), 1);
    const ny = estimate({ ...base, state: "NY" });
    expect(hasFlag(ny, "nyc_not_included")).toBe(true);
  });

  it("Ohio business income deduction: SE income up to $250,000 exempt, excess at 3%; wages on the flat schedule", () => {
    const oh = STATES.OH;
    if (oh.kind !== "flat" || !oh.businessIncome) throw new Error("OH should be flat with businessIncome");
    expect(oh.businessIncome.deduction.single).toBe(250000);
    expect(oh.businessIncome.deduction.mfs).toBe(125000);
    // $100k 1099, no W-2: all of AGI is business income below $250,000 → 0.
    expect(estimate({ ...base, state: "OH", expectedAnnual1099Income: 100000 }).tax.state).toBe(0);
    // $60k W-2 + $40k 1099: only the wages go through the flat schedule: rate × (60,000 − deduction).
    const mixed = estimate({ ...base, state: "OH", w2Wages: 60000, w2Withholding: 6000, expectedAnnual1099Income: 40000 });
    expect(mixed.tax.state).toBeCloseTo(oh.rate * (60000 - oh.deduction.single), 2);
    // $400k 1099: business income in AGI = 400,000 − ½ SE tax; excess over 250,000 at 3%.
    const big = estimate({ ...base, state: "OH", expectedAnnual1099Income: 400000 });
    expect(big.tax.state).toBeCloseTo(oh.businessIncome.excessRate * (big.income.agi - 250000), 1);
  });

  it("approximate state = effective rate × AGI, flagged", () => {
    const code = firstOf("approx");
    expect(code).toBeDefined();
    const rule = STATES[code!];
    if (rule.kind !== "approx") throw new Error("unreachable");
    const r = estimate({ ...base, state: code! });
    expect(r.tax.stateMethod).toBe("approx");
    expect(r.tax.state).toBeCloseTo(agi * rule.effectiveRate, 1);
    expect(hasFlag(r, "state_approximate")).toBe(true);
  });
});

describe("ICS", () => {
  it("CRLF, folded at 75 octets, only remaining deadlines, amount in SUMMARY", () => {
    const r = estimate({ ...base, asOf: "2026-06-16", estimatedPaymentsMade: [{ date: "2026-04-10", amount: 1000 }] });
    const ics = toICS(r);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    const lines = ics.split("\r\n");
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.some((l) => l.startsWith(" "))).toBe(true); // long DESCRIPTION lines are folded
    expect(ics).not.toContain("q1@penaltyproof");
    expect(ics).not.toContain("q2@penaltyproof");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect(ics).toContain("DTSTAMP:20260616T000000Z");
    expect(ics).toContain("TRIGGER:-P3D");
    expect(ics).toContain("https://www.irs.gov/payments/direct-pay");
    // Q3 amount = next deadline amount due; Q4 = its planned payment.
    expect(ics).toContain(`SUMMARY:Pay $${r.nextDeadline!.amountDue.toFixed(2)} federal estimated tax (Q3 2026)`);
    expect(ics).toContain(`SUMMARY:Pay $${r.installments[3]!.plannedPayment.toFixed(2)} federal estimated tax (Q4 2026)`);
    // Unfolding restores the original content.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:Federal estimated tax payment (Form 1040-ES) for Q3 2026\\, due 2026-09-15");
  });

  it("foldLine never splits a multi-byte character", () => {
    const line = "DESCRIPTION:" + "é".repeat(100);
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("annualized (Schedule AI)", () => {
  it("lumpy Q4 income gives lower early instalments than the regular method", () => {
    const input: TaxInput = {
      filingStatus: "single", state: "TX", asOf: "2026-12-31",
      payments1099: [{ date: "2026-01-20", amount: 2000 }, { date: "2026-11-20", amount: 30000 }, { date: "2026-12-20", amount: 28000 }],
    };
    const regular = estimate(input).installments[0]!.required;
    const a = annualized(input);
    for (const q of [0, 1, 2]) expect(a.installments[q]!.required).toBeLessThan(regular);
    expect(a.installments[3]!.required).toBeGreaterThan(regular);
    expect(a.totalRequired).toBeCloseTo(estimate(input).safeHarbor.requiredAnnualPayment, 1);
    expect(a.savingsVsRegular).toBeGreaterThan(0);
  });

  it("without dated payments assumes even income and says so", () => {
    const a = annualized(base);
    expect(hasFlag(a, "annualized_income_assumed_even")).toBe(true);
    const req = estimate(base).installments[0]!.required;
    // Periods end on month boundaries while the even spread is by day, so allow ~3%.
    for (const i of a.installments) expect(Math.abs(i.required - req) / req).toBeLessThan(0.03);
  });
});

describe("fix wave", () => {
  it("C1: on a joint return W-2 wages default to the spouse's (0 for the SS base) and are flagged", () => {
    // MFJ, spouse's job 200,000, freelancer 100,000 → net earnings 92,350; SS = 12.4% × 92,350 = 11,451.40
    const r = estimate({ ...base, filingStatus: "mfj", w2Wages: 200000, w2Withholding: 30000, expectedAnnual1099Income: 100000 });
    expect(r.input.w2WagesOfFreelancer).toBe(0);
    expect(r.tax.seSocialSecurity).toBeCloseTo(11451.4, 2);
    expect(hasFlag(r, "w2_owner_assumed_spouse")).toBe(true);
    expect(hasFlag(r, "ss_wage_base_reached")).toBe(false);
    const given = estimate({ ...base, filingStatus: "mfj", w2Wages: 200000, w2WagesOfFreelancer: 200000, expectedAnnual1099Income: 100000 });
    expect(given.tax.seSocialSecurity).toBe(0);
    expect(hasFlag(given, "w2_owner_assumed_spouse")).toBe(false);
    // Single: the wages are the filer's own.
    const single = estimate({ ...base, w2Wages: 200000, w2Withholding: 40000, expectedAnnual1099Income: 100000 });
    expect(single.input.w2WagesOfFreelancer).toBe(200000);
    expect(single.tax.seSocialSecurity).toBe(0);
    expect(hasFlag(single, "w2_owner_assumed_spouse")).toBe(false);
  });

  it("I1: phase-in uses the SSTB bound (reviewer case: single, 270,000 → ≈ 13,023.6)", () => {
    const r = estimate({ ...base, expectedAnnual1099Income: 270000 });
    expect(Math.abs(r.income.qbiDeduction - 13023.6)).toBeLessThan(1);
    expect(r.flags.find((f) => f.code === "qbi_phase_in")?.message).toContain("199A(d)(3)");
  });

  it("I2: only estimated payments dated Jan 1 .. asOf are credited; others are echoed and flagged", () => {
    const r = estimate({
      ...base, asOf: "2026-04-01", expectedAnnual1099Income: 80000,
      estimatedPaymentsMade: [{ date: "2026-09-10", amount: 20000 }, { date: "2025-12-31", amount: 500 }, { date: "2026-03-01", amount: 100 }],
    });
    expect(r.installments[0]!.status).toBe("due");
    expect(r.installments[0]!.paymentsCredited).toBe(100);
    expect(r.nextDeadline!.amountDue).toBeCloseTo(r.installments[0]!.required - 100, 2);
    expect(r.input.estimatedPaymentsMade).toHaveLength(3);
    const flag = r.flags.find((f) => f.code === "payment_ignored_out_of_range");
    expect(flag?.message).toContain("2026-09-10");
    expect(flag?.message).toContain("2025-12-31");
  });

  it("I3: annual + expenses only → YTD is the even share of net profit, never negative", () => {
    // 2026-07-01 = day 182: YTD net = (100,000 − 20,000) × 182/365 = 39,890.41
    const r = estimate({ ...base, asOf: "2026-07-01", expectedAnnual1099Income: 100000, businessExpenses: 20000 });
    expect(r.income.net1099Annual).toBe(80000);
    expect(r.income.net1099Ytd).toBeCloseTo((80000 * 182) / 365, 2);
    expect(hasFlag(r, "ytd_assumed_even")).toBe(true);
    // Catch-up = freelance tax / remaining income, so ≥ the steady rate (freelance tax / full-year income).
    expect(r.setAside.catchUpRate).toBeGreaterThanOrEqual(r.setAside.rate);
    // Expenses larger than YTD receipts: clamp at 0.
    const early = estimate({ ...base, asOf: "2026-07-01", ytd1099Income: 1000, expectedAnnual1099Income: 100000, businessExpenses: 20000 });
    expect(early.income.net1099Ytd).toBe(0);
  });

  it("I4: projection from under 60 days is flagged", () => {
    const r = estimate({ filingStatus: "single", state: "TX", asOf: "2026-01-02", ytd1099Income: 5000 });
    expect(r.income.projected).toBe(true);
    expect(hasFlag(r, "projection_early")).toBe(true);
    expect(hasFlag(estimate({ filingStatus: "single", state: "TX", asOf: "2026-03-01", ytd1099Income: 5000 }), "projection_early")).toBe(false);
  });

  it("I5: joint return with 1099 income flags the one-self-employed-person assumption", () => {
    expect(hasFlag(estimate({ ...base, filingStatus: "mfj" }), "mfj_one_self_employed_assumed")).toBe(true);
    expect(hasFlag(estimate(base), "mfj_one_self_employed_assumed")).toBe(false);
  });

  it("I6: freelance rate is incremental; W-2 under-withholding is flagged, not loaded onto freelance income", () => {
    const input: TaxInput = { ...base, w2Wages: 100000, w2Withholding: 0, expectedAnnual1099Income: 2000 };
    const r = estimate(input);
    const wageOnly = estimate({ ...input, expectedAnnual1099Income: 0 });
    expect(r.tax.freelanceTax).toBeCloseTo(r.tax.total - wageOnly.tax.total, 1);
    expect(r.rates.effectiveOnFreelance).toBeCloseTo(r.tax.freelanceTax / 2000, 3);
    expect(r.rates.effectiveOnFreelance).toBeLessThan(0.45);
    expect(r.setAside.rate).toBeCloseTo(r.rates.effectiveOnFreelance, 4);
    expect(r.setAside.catchUpRate).toBeLessThan(0.6);
    expect(hasFlag(r, "w2_underwithheld")).toBe(true);
    // Withholding beyond the wage-only tax reduces the set-aside.
    const over = estimate({ ...input, w2Withholding: wageOnly.tax.federalTotal + 50000 });
    expect(over.setAside.catchUpRate).toBe(0);
    expect(hasFlag(over, "w2_underwithheld")).toBe(false);
    // Safe harbor stays whole-return.
    expect(r.safeHarbor.currentYearOption).toBeCloseTo(0.9 * r.tax.federalTotal, 1);
  });

  it("withholding_covers_safe_harbor when withholding alone meets the required annual payment", () => {
    const r = estimate({ ...base, w2Wages: 100000, w2Withholding: 30000, priorYearTax: 20000, priorYearAgi: 140000 });
    expect(r.safeHarbor.rule).not.toBe("noneRequired");
    expect(hasFlag(r, "withholding_covers_safe_harbor")).toBe(true);
    expect(r.installments.every((i) => i.plannedPayment === 0)).toBe(true);
  });

  it("ICS: skips $0 instalments, adds the return due date when asked or when nothing else is left, has SEQUENCE", () => {
    // Q1 overpaid enough to cover Q2 and Q3; Q4 still owed.
    const r = estimate({ ...base, asOf: "2026-04-20", priorYearTax: 8000, priorYearAgi: 50000, estimatedPaymentsMade: [{ date: "2026-04-10", amount: 6000 }] });
    const ics = toICS(r);
    expect(ics).not.toContain("q2@penaltyproof");
    expect(ics).not.toContain("q3@penaltyproof");
    expect(ics).toContain("q4@penaltyproof");
    expect(ics).not.toContain("return@penaltyproof");
    expect(ics).toContain("SEQUENCE:109\r\n"); // 2026-01-01 → 2026-04-20
    const withReturn = toICS(r, { includeReturnDue: true }).replace(/\r\n /g, "");
    expect(withReturn).toContain("DTSTART;VALUE=DATE:20270415");
    expect(withReturn).toContain(`SUMMARY:Pay $${r.aprilTrueUp.toFixed(2)} federal balance with your 2026 return`);
    // After the last instalment: never an empty calendar.
    const after = toICS(estimate({ ...base, asOf: "2027-02-01" }));
    expect((after.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
    expect(after).toContain("UID:penaltyproof-2026-return@penaltyproof");
    // Nothing owed: a "file your return" event.
    const none = toICS(estimate({ ...base, asOf: "2026-03-01", priorYearTax: 0, priorYearAgi: 0, estimatedPaymentsMade: [{ date: "2026-02-01", amount: 20000 }] }));
    expect(none).toContain("SUMMARY:File your 2026 federal return");
    expect((none.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
  });

  it("invalid input throws TaxInputError", () => {
    const bad: unknown[] = [
      { ...base, w2Wages: Number.NaN },
      { ...base, expectedAnnual1099Income: -1 },
      { ...base, estimatedPaymentsMade: [null] },
      { ...base, payments1099: [{ date: "2026-13-01", amount: 1 }] },
      { ...base, state: "XX" },
      { ...base, filingStatus: "joint" },
      { ...base, asOf: "2025-12-31" },
      { ...base, asOf: "2027-04-16" },
      { ...base, asOf: "03/01/2026" },
      { ...base, priorYearFullYear: "no" },
    ];
    for (const input of bad) expect(() => estimate(input as TaxInput)).toThrow(TaxInputError);
    expect(() => estimate({ ...base, asOf: "2027-04-15" })).not.toThrow();
  });
});
