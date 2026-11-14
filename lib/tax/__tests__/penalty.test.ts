// estimateAccruedPenalty: hand-computed expectations (Form 2210 Part III penalty worksheet, simplified).
//
// Rates used (IRS underpayment rate for individuals, which IRC 6654 applies to estimated tax):
//   2026 Q1 7% (Rev. Rul. 2025-22), Q2 6% (Rev. Rul. 2026-5), Q3 7% (Rev. Rul. 2026-10), Q4 7% (Rev. Rul. 2026-15).
// Penalty on a balance B from day a to day b (days counted as b − a, like the worksheet's "days from ... to the
// date paid") = B × rate × days / 365, with days split at the quarter ends 6/30, 9/30, 12/31.
//
// Persona used throughout (the README example): single, TX, expects $60,000 freelance income, 2025 tax $8,000 on
// AGI $50,000. 90% of 2026 tax (~$10,833) > $8,000, so the safe harbor is prior100: $8,000 a year = $2,000 per
// instalment, due 4/15, 6/15, 9/15 (2026) and 1/15 (2027). Each test first checks those engine fields.

import { describe, expect, it } from "vitest";
import { estimate, estimateAccruedPenalty, TaxInputError, type TaxInput } from "../index";

const persona: TaxInput = {
  filingStatus: "single",
  state: "TX",
  asOf: "2026-09-01",
  expectedAnnual1099Income: 60000,
  priorYearTax: 8000,
  priorYearAgi: 50000,
};

describe("estimateAccruedPenalty", () => {
  it("one missed quarter (Q2 never paid)", () => {
    // Q1 paid on time (4/10). Q2 ($2,000, due 6/15) unpaid on asOf 9/1.
    const r = estimate({ ...persona, estimatedPaymentsMade: [{ date: "2026-04-10", amount: 2000 }] });
    expect(r.installments.map((x) => x.required)).toEqual([2000, 2000, 2000, 2000]);
    expect(r.installments[1]?.status).toBe("pastDue");
    const p = estimateAccruedPenalty(r);
    // Q2: 6/15 -> 9/1 = 15 (to 6/30) + 31 + 31 + 1 = 78 days.
    //   6/15 -> 6/30: 15 days at 6%  -> 2000 × 0.06 × 15 = 1800 (÷365 later)
    //   6/30 -> 9/1 : 63 days at 7%  -> 2000 × 0.07 × 63 = 8820
    //   (1800 + 8820) / 365 = 10620 / 365 = 29.0958... -> 29.10
    // Q1: paid before its due date -> underpayment 0, penalty 0.
    // Daily cost: 2000 × 0.07 / 365 = 0.38356 -> 0.38.
    expect(p).toEqual({
      total: 29.1,
      perInstallment: [
        { quarter: 1, due: "2026-04-15", underpayment: 0, daysLate: 0, penalty: 0 },
        { quarter: 2, due: "2026-06-15", underpayment: 2000, daysLate: 78, penalty: 29.1 },
      ],
      ratePerYear: 0.07,
      dailyCostIfUnpaid: 0.38,
      asOf: "2026-09-01",
      method: expect.stringContaining("estimate"),
    });

    // Measured 7 days later (opts.asOf 9/8): + 2000 × 0.07 × 7 / 365 = 980/365.
    //   (10620 + 980) / 365 = 11600 / 365 = 31.7808 -> 31.78
    const later = estimateAccruedPenalty(r, { asOf: "2026-09-08" });
    expect(later.total).toBe(31.78);
    expect(later.perInstallment[1]?.daysLate).toBe(85);
  });

  it("a missed quarter partly paid late, then a second missed quarter (earliest-unpaid-first)", () => {
    // Q1 paid 4/10 ($2,000). A $1,500 payment on 7/20 goes to Q2 (the earliest unpaid instalment), not Q3.
    // asOf 2026-11-14.
    const r = estimate({
      ...persona,
      asOf: "2026-11-14",
      estimatedPaymentsMade: [
        { date: "2026-04-10", amount: 2000 },
        { date: "2026-07-20", amount: 1500 },
      ],
    });
    expect(r.installments.map((x) => x.required)).toEqual([2000, 2000, 2000, 2000]);
    expect(r.installments.map((x) => x.paymentsCredited)).toEqual([2000, 1500, 0, 0]);
    expect(r.installments[1]?.shortfall).toBe(500); // 4000 − 3500
    expect(r.installments[2]?.shortfall).toBe(2500);
    const p = estimateAccruedPenalty(r);
    // Q2 (underpayment 2000 on 6/15):
    //   6/15 -> 6/30 : 2000 × 6% × 15 = 1800
    //   6/30 -> 7/20 : 2000 × 7% × 20 = 2800
    //   7/20 -> 11/14: 500 × 7% × 117 = 4095   (11 + 31 + 30 + 31 + 14 = 117 days, all at 7% in Q3/Q4)
    //   (1800 + 2800 + 4095) / 365 = 8695 / 365 = 23.8219 -> 23.82; still unpaid, daysLate 6/15 -> 11/14 = 152.
    // Q3 (underpayment 2000 on 9/15): 9/15 -> 11/14 = 15 + 31 + 14 = 60 days at 7%
    //   2000 × 0.07 × 60 = 8400; 8400 / 365 = 23.0137 -> 23.01.
    // Total: (8695 + 8400) / 365 = 17095 / 365 = 46.8356 -> 46.84.
    // Daily cost: (500 + 2000) × 0.07 / 365 = 175 / 365 = 0.4795 -> 0.48.
    expect(p.perInstallment).toEqual([
      { quarter: 1, due: "2026-04-15", underpayment: 0, daysLate: 0, penalty: 0 },
      { quarter: 2, due: "2026-06-15", underpayment: 2000, daysLate: 152, penalty: 23.82 },
      { quarter: 3, due: "2026-09-15", underpayment: 2000, daysLate: 60, penalty: 23.01 },
    ]);
    expect(p.total).toBe(46.84);
    expect(p.dailyCostIfUnpaid).toBe(0.48);
    expect(p.ratePerYear).toBe(0.07);
  });

  it("a short quarter paid off later in full stops accruing on the payment date", () => {
    // Q1 nothing paid until 5/15 ($2,000). asOf 7/1. Q2 then also unpaid.
    // Q1: 4/15 -> 5/15 = 30 days at 6% -> 2000 × 0.06 × 30 = 3600; 3600/365 = 9.8630 -> 9.86, daysLate 30.
    // Q2: 6/15 -> 7/1 = 15 days at 6% + 1 day at 7% -> 1800 + 140 = 1940; 1940/365 = 5.3151 -> 5.32.
    // Total: (3600 + 1940) / 365 = 5540 / 365 = 15.1781 -> 15.18. Daily cost 2000 × 0.07 / 365 -> 0.38.
    const r = estimate({ ...persona, asOf: "2026-07-01", estimatedPaymentsMade: [{ date: "2026-05-15", amount: 2000 }] });
    const p = estimateAccruedPenalty(r);
    expect(p.perInstallment).toEqual([
      { quarter: 1, due: "2026-04-15", underpayment: 2000, daysLate: 30, penalty: 9.86 },
      { quarter: 2, due: "2026-06-15", underpayment: 2000, daysLate: 16, penalty: 5.32 },
    ]);
    expect(p.total).toBe(15.18);
    expect(p.dailyCostIfUnpaid).toBe(0.38);
  });

  it("withholding is deemed paid on the due dates and goes to the earliest unpaid instalment", () => {
    // Add $20,000 W-2 wages with $4,000 withholding: tax rises, so prior100 ($8,000) still applies; withholding
    // is $1,000 per due date. No estimated payments; asOf 7/1.
    // Q1: 2000 − 1000 = 1000 short on 4/15. On 6/15 the Q2 withholding ($1,000) pays off Q1 first.
    //   4/15 -> 6/15 = 15 + 31 + 15 = 61 days at 6%: 1000 × 0.06 × 61 = 3660; /365 = 10.0274 -> 10.03.
    // Q2: nothing left for it on 6/15 -> underpayment 2000.
    //   6/15 -> 7/1: 1800 + 140 = 1940; /365 = 5.3151 -> 5.32.
    // Total: (3660 + 1940) / 365 = 5600 / 365 = 15.3425 -> 15.34.
    const r = estimate({ ...persona, asOf: "2026-07-01", w2Wages: 20000, w2Withholding: 4000 });
    expect(r.installments.map((x) => x.required)).toEqual([2000, 2000, 2000, 2000]);
    expect(r.installments.map((x) => x.withholdingCredited)).toEqual([1000, 1000, 1000, 1000]);
    expect(r.installments[1]?.shortfall).toBe(2000); // 4000 − 2000 withholding
    const p = estimateAccruedPenalty(r);
    expect(p.perInstallment).toEqual([
      { quarter: 1, due: "2026-04-15", underpayment: 1000, daysLate: 61, penalty: 10.03 },
      { quarter: 2, due: "2026-06-15", underpayment: 2000, daysLate: 16, penalty: 5.32 },
    ]);
    expect(p.total).toBe(15.34);
  });

  it("nothing past due -> 0", () => {
    // Before the first due date: no instalment can carry a penalty.
    const early = estimateAccruedPenalty(estimate({ ...persona, asOf: "2026-04-10" }));
    expect(early.total).toBe(0);
    expect(early.perInstallment).toEqual([]);
    expect(early.dailyCostIfUnpaid).toBe(0);
    expect(early.ratePerYear).toBe(0.06); // 4/10 is in Q2 2026

    // Q1 and Q2 paid on or before their due dates (a payment on the due date is on time).
    const r = estimate({
      ...persona,
      asOf: "2026-08-01",
      estimatedPaymentsMade: [
        { date: "2026-04-15", amount: 2000 },
        { date: "2026-06-01", amount: 2000 },
      ],
    });
    const p = estimateAccruedPenalty(r);
    expect(p.total).toBe(0);
    expect(p.dailyCostIfUnpaid).toBe(0);
    expect(p.perInstallment.every((x) => x.penalty === 0 && x.underpayment === 0 && x.daysLate === 0)).toBe(true);
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });

  it("rejects an asOf outside the penalty window", () => {
    const r = estimate(persona);
    expect(() => estimateAccruedPenalty(r, { asOf: "2027-04-16" })).toThrow(TaxInputError);
    expect(() => estimateAccruedPenalty(r, { asOf: "2026-02-30" })).toThrow(TaxInputError);
  });
});
