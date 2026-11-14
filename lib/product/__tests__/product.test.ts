import { describe, expect, it } from "vitest";
import { estimate, setAsideForPayment } from "@/lib/tax";
import { todayIso, localIsoDate } from "@/lib/product/asof";
import { buildTaxInput } from "@/lib/product/input";
import { meterLabel, meterPctLabel, meterSegments, penaltyMeter } from "@/lib/product/meter";
import { longDate, money, moneyCents, pct } from "@/lib/product/format";
import { buildExample, EXAMPLE_ANSWERS } from "@/lib/product/example";
import { STATE_OPTIONS, stateName, isStateCode } from "@/lib/product/states";
import type { LogEntry, Profile } from "@/lib/product/types";

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

  it("dates the quiz lump sum at asOf, clamped to Jan 1..Sep 15, and adds irs entries", () => {
    const p = { ...profile, estimatedPaid: 3700 };
    expect(buildTaxInput(p, [], "2026-07-01").estimatedPaymentsMade).toEqual([{ date: "2026-07-01", amount: 3700 }]);
    expect(buildTaxInput(p, [], "2026-11-14").estimatedPaymentsMade).toEqual([{ date: "2026-09-15", amount: 3700 }]);
    expect(buildTaxInput(p, [], "2026-01-01").estimatedPaymentsMade).toEqual([{ date: "2026-01-01", amount: 3700 }]);
    const log = [entry({ kind: "irs", amount: 1000, date: "2026-10-01" }), entry({ kind: "income", amount: 500 })];
    expect(buildTaxInput(p, log, "2026-11-14").estimatedPaymentsMade).toEqual([
      { date: "2026-09-15", amount: 3700 },
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
  it("covers paid + set-aside against the safe-harbor target", () => {
    const p = { ...profile, estimatedPaid: 4000 };
    const result = estimate(buildTaxInput(p, [], "2026-07-01"));
    const log = [
      entry({ kind: "income", amount: 2500, setAside: 501.5 }),
      entry({ kind: "irs", amount: 1000, setAside: 0 }),
      entry({ kind: "income", amount: 1000, setAside: 200.6 }),
    ];
    const m = penaltyMeter(result, log);
    expect(m.paid).toBe(result.progress.annualPaid);
    expect(m.paid).toBe(4000);
    expect(m.setAside).toBe(702.1);
    expect(m.target).toBe(8000); // prior-year 100% rule, see engine README example
    expect(m.pct).toBeCloseTo(((4000 + 702.1) / 8000) * 100, 10);
    expect(m.quarter).toBe(result.nextDeadline?.quarter);
    expect(meterLabel(m)).toBe(`Q${m.quarter}: 58% penalty-proof`);
    const seg = meterSegments(m);
    expect(seg.paidPct).toBe(50);
    expect(seg.setAsidePct).toBeCloseTo(8.77625, 10);
  });

  it("caps at 100% and shows 100 when nothing is required", () => {
    const result = estimate(buildTaxInput({ ...profile, estimatedPaid: 4000 }, [], "2026-07-01"));
    const m = penaltyMeter(result, [entry({ kind: "income", amount: 1, setAside: 99999 })]);
    expect(m.pct).toBe(100);
    expect(meterSegments(m).paidPct + meterSegments(m).setAsidePct).toBe(100);

    const none = estimate(buildTaxInput({ ...profile, priorYearTax: 0 }, [], "2026-07-01"));
    expect(none.safeHarbor.requiredAnnualPayment).toBe(0);
    expect(penaltyMeter(none, []).pct).toBe(100);
  });

  it("rounds the label down so it never claims 100% early", () => {
    const m = { paid: 7999, setAside: 0, target: 8000, pct: 99.9875, quarter: 4 as const };
    expect(meterPctLabel(m)).toBe(99);
    expect(meterLabel({ ...m, quarter: null })).toBe("99% penalty-proof");
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
  it("builds Maya with an engine-computed set-aside on the pre-entry result", () => {
    const { profile: p, entry: e } = buildExample("2026-11-14", new Date("2026-11-14T12:00:00Z"));
    expect(p).toMatchObject(EXAMPLE_ANSWERS);
    expect(p.createdAt).toBe("2026-11-14T12:00:00.000Z");
    const before = estimate(buildTaxInput(p, [], "2026-11-14"));
    expect(e).toEqual({
      kind: "income",
      amount: 4200,
      payer: "Northwind Studio",
      date: "2026-11-03",
      setAside: setAsideForPayment(before, 4200).setAside,
    });
    expect(e.setAside).toBeGreaterThan(0);
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
