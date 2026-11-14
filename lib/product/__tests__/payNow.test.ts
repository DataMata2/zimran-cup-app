import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estimate, estimateAccruedPenalty, type PenaltyEstimate, type TaxResult } from "@/lib/tax";
import { buildExample } from "@/lib/product/example";
import { buildTaxInput } from "@/lib/product/input";
import { aboutMoney, missedLabel, nextLabel, pastDue, pastDueSentence, payNowPlan, quarterList, WEEKLY_PENALTY_MIN } from "@/lib/product/payNow";
import { ENGINE_TEST_COUNT } from "@/lib/product/trust";
import type { LogEntry, Profile } from "@/lib/product/types";

const AS_OF = "2026-11-14";

const fresh: Profile = {
  filingStatus: "single",
  state: "TX",
  ytdIncome: 30000,
  expectedIncome: 60000,
  w2Wages: 0,
  w2Withholding: 0,
  priorYearTax: 8000,
  priorYearAgi: 50000,
  estimatedPaid: 0,
  createdAt: "2026-07-01T00:00:00.000Z",
  isExample: false,
};

type Q = 1 | 2 | 3 | 4;
const DUES: Record<Q, string> = { 1: "2026-04-15", 2: "2026-06-15", 3: "2026-09-15", 4: "2027-01-15" };

/** A minimal result: the given quarters past due with these cumulative shortfalls, and the next deadline amount. */
function fake(pastDue: Partial<Record<Q, number>>, amountDue: number | null): TaxResult {
  return {
    installments: ([1, 2, 3, 4] as Q[]).map((q) => ({
      quarter: q,
      due: DUES[q],
      shortfall: pastDue[q] ?? 0,
      status: pastDue[q] !== undefined ? "pastDue" : q === 4 ? "upcoming" : "paid",
    })),
    nextDeadline:
      amountDue === null ? null : { quarter: 4, due: DUES[4], amountDue, includesPastDue: Object.keys(pastDue).length > 0 },
  } as unknown as TaxResult;
}

const penalty = (weekly: number, total = 50) => ({ weeklyCostIfUnpaid: weekly, total }) as unknown as PenaltyEstimate;

describe("quarterList / pastDueSentence", () => {
  it("names one quarter", () => {
    expect(quarterList([3])).toBe("Q3");
    expect(pastDueSentence([3])).toBe("Q3 is past due.");
  });

  it("joins two quarters with 'and', adjacent or not", () => {
    expect(quarterList([1, 3])).toBe("Q1 and Q3");
    expect(quarterList([2, 3])).toBe("Q2 and Q3");
    expect(pastDueSentence([1, 3])).toBe("Q1 and Q3 are past due.");
  });

  it("reads a run of three as a range", () => {
    expect(quarterList([1, 2, 3])).toBe("Q1–Q3");
    expect(pastDueSentence([3, 1, 2])).toBe("Q1–Q3 are past due.");
  });

  it("lists a broken run of three in full", () => {
    expect(quarterList([1, 2, 4])).toBe("Q1, Q2 and Q4");
  });
});

describe("missedLabel / nextLabel", () => {
  it("labels the pay-now amount by the missed quarters", () => {
    expect(missedLabel([3])).toBe("Missed Q3 payment");
    expect(missedLabel([1, 2, 3])).toBe("Missed Q1–Q3 payments");
    expect(missedLabel([1, 3])).toBe("Missed Q1 and Q3 payments");
  });

  it("labels the next instalment by its quarter", () => {
    expect(nextLabel(4)).toBe("Next quarterly payment (Q4)");
  });
});

describe("payNowPlan", () => {
  it("is null when nothing is past due", () => {
    expect(payNowPlan(fake({}, 2000), penalty(0, 0))).toBeNull();
  });

  it("pays the cumulative shortfall now and the rest by the next deadline", () => {
    const plan = payNowPlan(fake({ 1: 2000, 2: 4000, 3: 6000 }, 8000), penalty(10.74, 160.12));
    expect(plan).toMatchObject({
      amount: 6000,
      quarters: [1, 2, 3],
      pastDueText: "Q1–Q3 are past due.",
      weeklyPenalty: 10.74,
      then: { amount: 2000, due: "2027-01-15" },
      penaltySoFar: 160.12,
    });
  });

  it("names non-adjacent past-due quarters from the instalments", () => {
    expect(payNowPlan(fake({ 1: 500, 3: 900 }, 1500), penalty(2))?.pastDueText).toBe("Q1 and Q3 are past due.");
  });

  it("clamps the 'then' amount at 0 and hides it", () => {
    expect(payNowPlan(fake({ 3: 6000 }, 6000), penalty(5))?.then).toBeNull();
    expect(payNowPlan(fake({ 3: 6000 }, 5000), penalty(5))?.then).toBeNull();
    expect(payNowPlan(fake({ 3: 6000 }, 6000.3), penalty(5))?.then).toBeNull();
    expect(payNowPlan(fake({ 3: 6000 }, null), penalty(5))?.then).toBeNull();
  });

  it("is null when the past-due shortfall would show as $0", () => {
    expect(payNowPlan(fake({ 3: 0.4 }, 1000), penalty(0))).toBeNull();
  });

  it("hides the weekly penalty under $1", () => {
    expect(payNowPlan(fake({ 3: 50 }, 50), penalty(WEEKLY_PENALTY_MIN - 0.01))?.weeklyPenalty).toBeNull();
    expect(payNowPlan(fake({ 3: 50 }, 50), penalty(0))?.weeklyPenalty).toBeNull();
    expect(payNowPlan(fake({ 3: 60 }, 60), penalty(WEEKLY_PENALTY_MIN))?.weeklyPenalty).toBe(WEEKLY_PENALTY_MIN);
  });

  it("fresh quiz case, nothing paid by Nov 14: Q1–Q3, the same amount as pastDue, the rest by Jan 15", () => {
    const result = estimate(buildTaxInput(fresh, [], AS_OF));
    const pen = estimateAccruedPenalty(result);
    const plan = payNowPlan(result, pen)!;
    expect(plan.pastDueText).toBe("Q1–Q3 are past due.");
    expect(plan.amount).toBe(pastDue(result)!.amount);
    expect(plan.then?.amount).toBeCloseTo(result.nextDeadline!.amountDue - plan.amount, 6);
    expect(plan.then?.due).toBe("2027-01-15");
    expect(plan.weeklyPenalty).toBe(pen.weeklyCostIfUnpaid);
    expect(plan.penaltySoFar).toBe(pen.total);
    expect(plan.penaltySoFar).toBeGreaterThan(0);
  });

  it("the example persona Maya missed only Q3", () => {
    const { profile, entry } = buildExample(AS_OF, new Date("2026-11-14T12:00:00Z"));
    const log: LogEntry[] = [{ ...entry, id: "e1", createdAt: "2026-11-14T12:00:00.000Z" }];
    const result = estimate(buildTaxInput(profile, log, AS_OF));
    const plan = payNowPlan(result, estimateAccruedPenalty(result))!;
    expect(plan.quarters).toEqual([3]);
    expect(plan.pastDueText).toBe("Q3 is past due.");
    expect(plan.amount).toBeGreaterThan(0);
    // The quiz lump ($3,700) is assumed paid on time, so Q1 and Q2 carry no penalty: only Q3 accrues.
    const pen = estimateAccruedPenalty(result);
    expect(pen.perInstallment.filter((i) => i.quarter !== 3).every((i) => i.penalty === 0)).toBe(true);
    expect(pen.total).toBe(pen.perInstallment.find((i) => i.quarter === 3)!.penalty);
  });
});

describe("aboutMoney", () => {
  it("rounds to dollars, and says 'less than $1' instead of $0", () => {
    expect(aboutMoney(160.12)).toBe("about $160");
    expect(aboutMoney(0.49)).toBe("less than $1");
    expect(aboutMoney(0)).toBe("less than $1");
  });
});

describe("ENGINE_TEST_COUNT", () => {
  it("matches the number of tests in lib/tax/__tests__", () => {
    const dir = join(process.cwd(), "lib/tax/__tests__");
    const count = readdirSync(dir)
      .filter((f) => f.endsWith(".test.ts"))
      .reduce((n, f) => n + (readFileSync(join(dir, f), "utf8").match(/^\s*(it|test)\(/gm)?.length ?? 0), 0);
    expect(count).toBe(ENGINE_TEST_COUNT);
  });
});
