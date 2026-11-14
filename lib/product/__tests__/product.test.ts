import { describe, expect, it } from "vitest";
import { estimate, setAsideForPayment } from "@/lib/tax";
import { todayIso, localIsoDate } from "@/lib/product/asof";
import { buildTaxInput } from "@/lib/product/input";
import { meterFill, meterPctLabel, meterSummary, meterTicks, meterValueText, penaltyMeter } from "@/lib/product/meter";
import { longDate, money, moneyCents, moneyPay, pct } from "@/lib/product/format";
import { buildExample, EXAMPLE_ANSWERS } from "@/lib/product/example";
import { STATE_OPTIONS, stateName, isStateCode } from "@/lib/product/states";
import type { LogEntry, Profile } from "@/lib/product/types";
import { setAsideAfterLogging } from "@/lib/product/plan";

const profile: Profile = {
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

let n = 0;
const entry = (e: Partial<LogEntry> & Pick<LogEntry, "kind" | "amount">): LogEntry => ({
  id: `id${n++}`,
  payer: "",
  date: "2026-07-01",
  setAside: 0,
  createdAt: "2026-07-01T00:00:00.000Z",
  ...e,
});

describe("todayIso", () => {
  it("uses the local calendar date", () => {
    expect(localIsoDate(new Date(2026, 10, 14, 23, 59))).toBe("2026-11-14");
    expect(todayIso(new Date(2026, 10, 14, 23, 59))).toBe("2026-11-14");
  });
  it("clamps to 2026-01-01..2027-04-15", () => {
    expect(todayIso(new Date(2025, 11, 31))).toBe("2026-01-01");
    expect(todayIso(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(todayIso(new Date(2027, 3, 15))).toBe("2027-04-15");
    expect(todayIso(new Date(2027, 3, 16))).toBe("2027-04-15");
    expect(todayIso(new Date(2030, 0, 1))).toBe("2027-04-15");
  });
});

describe("buildTaxInput", () => {
  it("passes the profile through with no log", () => {
    expect(buildTaxInput(profile, [], "2026-07-01")).toEqual({
      filingStatus: "single",
      state: "TX",
      asOf: "2026-07-01",
      ytd1099Income: 30000,
      expectedAnnual1099Income: 60000,
      w2Wages: 0,
      w2Withholding: 0,
      priorYearTax: 8000,
      priorYearAgi: 50000,
      estimatedPaymentsMade: [],
    });
  });

  it("adds income entries to YTD and raises expected to at least YTD", () => {
    const log = [entry({ kind: "income", amount: 20000 }), entry({ kind: "income", amount: 15000 })];
    const input = buildTaxInput(profile, log, "2026-07-01");
    expect(input.ytd1099Income).toBe(65000);
    expect(input.expectedAnnual1099Income).toBe(65000);
    expect(input.estimatedPaymentsMade).toEqual([]);
  });

  it("dates the quiz lump sum at asOf, clamped to Jan 1..Apr 15 (assumed paid on time), and adds irs entries", () => {
    const p = { ...profile, estimatedPaid: 3700 };
    expect(buildTaxInput(p, [], "2026-03-10").estimatedPaymentsMade).toEqual([{ date: "2026-03-10", amount: 3700 }]);
    expect(buildTaxInput(p, [], "2026-07-01").estimatedPaymentsMade).toEqual([{ date: "2026-04-15", amount: 3700 }]);
    expect(buildTaxInput(p, [], "2026-11-14").estimatedPaymentsMade).toEqual([{ date: "2026-04-15", amount: 3700 }]);
    expect(buildTaxInput(p, [], "2026-01-01").estimatedPaymentsMade).toEqual([{ date: "2026-01-01", amount: 3700 }]);
    const log = [entry({ kind: "irs", amount: 1000, date: "2026-10-01" }), entry({ kind: "income", amount: 500 })];
    expect(buildTaxInput(p, log, "2026-11-14").estimatedPaymentsMade).toEqual([
      { date: "2026-04-15", amount: 3700 },
      { date: "2026-10-01", amount: 1000 },
    ]);
  });

  it("keeps unknown prior-year values as null and W-2 values as given", () => {
    const p = { ...profile, priorYearTax: null, priorYearAgi: null, w2Wages: 40000, w2Withholding: 3000 };
    const input = buildTaxInput(p, [], "2026-07-01");
    expect(input.priorYearTax).toBeNull();
    expect(input.priorYearAgi).toBeNull();
    expect(input.w2Wages).toBe(40000);
    expect(input.w2Withholding).toBe(3000);
    expect(() => estimate(input)).not.toThrow();
  });
});

describe("penaltyMeter", () => {
  it("fills with IRS payments only, against the minimum due through the next deadline", () => {
    const p = { ...profile, estimatedPaid: 4000 };
    const result = estimate(buildTaxInput(p, [], "2026-07-01"));
    const log = [
      entry({ kind: "income", amount: 2500, setAside: 501.5 }),
      entry({ kind: "income", amount: 1000, setAside: 200.6 }),
    ];
    const m = penaltyMeter(result, log);
    expect(m.paid).toBe(result.progress.paidToDate);
    expect(m.paid).toBe(4000);
    expect(m.required).toBe(result.progress.requiredToDate);
    expect(m.required).toBe(6000); // Q1–Q3 of the $8,000 prior-year target; next deadline Sep 15
    expect(m.through).toEqual({ quarter: 3, due: "2026-09-15" });
    expect(m.pct).toBeCloseTo((4000 / 6000) * 100, 10);
    // Set-aside money is held separately and never fills the bar.
    expect(m.setAside).toBe(702.1);
    expect(meterFill(m)).toBeCloseTo(66.667, 3);
    expect(m.target).toBe(8000);
    expect(meterSummary(m)).toBe("$4,000 of the $6,000 minimum due by Sep 15, 2026");
    expect(meterValueText(m)).toBe("Paid to the IRS: $4,000 of the $6,000 minimum due by Sep 15, 2026 (66%)");
  });

  it("counts a logged IRS payment once: it leaves the set-aside pot and shows up as paid", () => {
    const p = { ...profile, estimatedPaid: 4000 };
    const log = [
      entry({ kind: "income", amount: 7500, setAside: 1500 }),
      entry({ kind: "irs", amount: 1000, date: "2026-06-15" }),
    ];
    const result = estimate(buildTaxInput(p, log, "2026-07-01"));
    const m = penaltyMeter(result, log);
    expect(m.paid).toBe(5000);
    expect(m.setAside).toBe(500);
    expect(m.pct).toBeCloseTo((5000 / 6000) * 100, 10);

    // Paying the IRS more than was set aside never makes the pot negative.
    const more = [...log, entry({ kind: "irs", amount: 2000, date: "2026-06-20" })];
    expect(penaltyMeter(estimate(buildTaxInput(p, more, "2026-07-01")), more).setAside).toBe(0);
  });

  it("a huge set-aside does not fill the bar", () => {
    const result = estimate(buildTaxInput({ ...profile, estimatedPaid: 0 }, [], "2026-07-01"));
    const m = penaltyMeter(result, [entry({ kind: "income", amount: 1, setAside: 99999 })]);
    expect(m.pct).toBe(0);
    expect(meterFill(m)).toBe(0);
    expect(m.setAside).toBe(99999);
  });

  it("caps at 100%, and says nothing was due when nothing is required", () => {
    const over = estimate(buildTaxInput({ ...profile, estimatedPaid: 7000 }, [], "2026-07-01"));
    expect(penaltyMeter(over, []).pct).toBe(100);

    const none = estimate(buildTaxInput({ ...profile, priorYearTax: 0 }, [], "2026-07-01"));
    expect(none.safeHarbor.requiredAnnualPayment).toBe(0);
    const m = penaltyMeter(none, []);
    expect(m.pct).toBeNull();
    expect(meterPctLabel(m)).toBeNull();
    expect(meterSummary(m)).toBe("Nothing was due yet");
    expect(meterValueText(m)).toBe("Paid to the IRS: Nothing was due yet");
  });

  it("runs through Q4 once no deadline is left", () => {
    const result = estimate(buildTaxInput(profile, [], "2027-02-01"));
    expect(result.nextDeadline).toBeNull();
    const m = penaltyMeter(result, []);
    expect(m.through.quarter).toBe(4);
    expect(m.required).toBe(result.safeHarbor.requiredAnnualPayment);
  });

  it("rounds the label down so it never claims 100% early", () => {
    const m = { paid: 7999, required: 8000, pct: 99.9875, setAside: 0, target: 8000, through: { quarter: 4 as const, due: "2027-01-15" } };
    expect(meterPctLabel(m)).toBe(99);
  });

  it("puts one tick per quarter the minimum covers", () => {
    const base = { paid: 0, required: 1, pct: 0, setAside: 0, target: 1 };
    expect(meterTicks({ ...base, through: { quarter: 4, due: "2027-01-15" } })).toEqual({
      ticks: [25, 50, 75, 100],
      labels: ["Q1", "Q2", "Q3", "Q4"],
    });
    expect(meterTicks({ ...base, through: { quarter: 2, due: "2026-06-15" } })).toEqual({ ticks: [50, 100], labels: ["Q1", "Q2"] });
  });
});

describe("format", () => {
  it("money rounds to whole dollars", () => {
    expect(money(1234.4)).toBe("$1,234");
    expect(money(1234.5)).toBe("$1,235");
    expect(money(0)).toBe("$0");
    expect(money(-0.2)).toBe("$0");
    expect(money(-1500)).toBe("-$1,500");
    expect(money(12060000000)).toBe("$12,060,000,000");
  });
  it("PP-QA-08 (ruling): moneyPay shows whole dollars for whole amounts, else exact cents", () => {
    expect(moneyPay(2000.25)).toBe("$2,000.25");
    expect(moneyPay(6000.75)).toBe("$6,000.75");
    expect(moneyPay(1850)).toBe("$1,850");
    expect(moneyPay(1850.0000001)).toBe("$1,850");
    expect(moneyPay(1849.999)).toBe("$1,850");
    expect(moneyPay(0)).toBe("$0");
    expect(money(2000.25)).toBe("$2,000"); // totals and breakdowns keep whole dollars
  });
  it("moneyCents shows two decimals", () => {
    expect(moneyCents(1234.5)).toBe("$1,234.50");
    expect(moneyCents(501.5)).toBe("$501.50");
    expect(moneyCents(0)).toBe("$0.00");
  });
  it("pct formats a fraction", () => {
    expect(pct(0.2006)).toBe("20.1%");
    expect(pct(0.25)).toBe("25%");
    expect(pct(0.2679, 0)).toBe("27%");
    expect(pct(0)).toBe("0%");
  });
  it("longDate", () => {
    expect(longDate("2027-01-15")).toBe("Jan 15, 2027");
    expect(longDate("2026-09-05")).toBe("Sep 5, 2026");
    expect(longDate("garbage")).toBe("garbage");
  });
});

describe("example and states", () => {
  it("builds Maya with an engine-computed set-aside on the plan after the entry (PP-QA-01)", () => {
    const { profile: p, entry: e } = buildExample("2026-11-14", new Date("2026-11-14T12:00:00Z"));
    expect(p).toMatchObject(EXAMPLE_ANSWERS);
    expect(p.createdAt).toBe("2026-11-14T12:00:00.000Z");
    const after = estimate(buildTaxInput(p, [{ ...e, id: "x", createdAt: "" }], "2026-11-14"));
    expect(e).toEqual({
      kind: "income",
      amount: 4200,
      payer: "Northwind Studio",
      date: "2026-11-03",
      setAside: setAsideForPayment(after, 4200).setAside,
    });
    expect(e.setAside).toBeGreaterThan(0);
  });
  it("PP-QA-01: a logged payment's set-aside uses the rate the plan shows right after it", () => {
    // Repro: profit so far and expected $1,000, 2025 unknown, then log $99,000.
    const p: Profile = {
      filingStatus: "single", state: "TX", ytdIncome: 1000, expectedIncome: 1000, w2Wages: 0, w2Withholding: 0,
      priorYearTax: null, priorYearAgi: null, estimatedPaid: 0, createdAt: "2026-11-14T12:00:00.000Z", isExample: false,
    };
    const asOf = "2026-11-14";
    const before = estimate(buildTaxInput(p, [], asOf));
    const got = setAsideAfterLogging(p, [], { amount: 99000, date: asOf }, asOf, before);
    const entry: LogEntry = { id: "a", kind: "income", amount: 99000, payer: "", date: asOf, setAside: got.setAside, createdAt: "" };
    const after = estimate(buildTaxInput(p, [entry], asOf));
    expect(got.rate).toBe(after.setAside.rate);
    expect(pct(got.rate, 0)).toBe(pct(after.setAside.rate, 0));
    expect(got.setAside).toBe(setAsideForPayment(after, 99000).setAside);
    expect(got.rate).toBeGreaterThan(before.setAside.rate); // the old rule gave the lower pre-payment rate
    // An existing entry keeps its stored setAside when the next one is logged.
    const next = setAsideAfterLogging(p, [entry], { amount: 500, date: asOf }, asOf, after);
    expect(next.setAside).toBeGreaterThan(0);
    expect(entry.setAside).toBe(got.setAside);
  });
  it("lists every engine state sorted by name", () => {
    const names = STATE_OPTIONS.map((s) => s.name);
    expect([...names].sort((a, b) => a.localeCompare(b, "en-US"))).toEqual(names);
    expect(STATE_OPTIONS.length).toBeGreaterThanOrEqual(51);
    expect(stateName("CA")).toBe("California");
    expect(isStateCode("CA")).toBe(true);
    expect(isStateCode("ZZ")).toBe(false);
  });
});
