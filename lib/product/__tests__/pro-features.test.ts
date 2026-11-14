import { beforeEach, describe, expect, it } from "vitest";
import { annualized, estimate } from "@/lib/tax";
import { buildTaxInput } from "@/lib/product/input";
import {
  ANNUALIZED_METHOD_LABEL, buildAnnualizedInput, computeAnnualizedPlan, payments1099, summarizeAnnualized,
} from "@/lib/product/annualizedPlan";
import { buildCsv, csvField, csvRows } from "@/lib/product/csv";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnnualizedCard } from "@/components/plan/AnnualizedCard";
import { buildExample } from "@/lib/product/example";
import { installmentRow, pastDue, payTarget } from "@/lib/product/payNow";
import { countedEntries, entriesUsed, nextAdded } from "@/lib/product/freeLimit";
import { needsPro } from "@/lib/product/plan";
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

const entry = (over: Partial<LogEntry>): LogEntry => ({
  id: Math.random().toString(36),
  kind: "income",
  amount: 1000,
  payer: "",
  date: "2026-05-02",
  setAside: 200,
  createdAt: "2026-05-02T00:00:00.000Z",
  ...over,
});

describe("payments1099", () => {
  it("spreads ytdIncome over Jan..asOf month on the 15th and adds logged income on its own date", () => {
    const log = [entry({ amount: 4200, date: "2026-06-03" }), entry({ kind: "irs", amount: 999, date: "2026-06-10" })];
    const p = payments1099({ ...profile, ytdIncome: 1000, createdAt: "2026-07-20T00:00:00.000Z" }, log, "2026-07-20");
    // 7 months; cents add up exactly; IRS payments are not income.
    expect(p.filter((x) => x.date.endsWith("-15")).map((x) => x.date)).toEqual([
      "2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15", "2026-07-15",
    ]);
    expect(p.reduce((s, x) => s + Math.round(x.amount * 100), 0)).toBe(1000 * 100 + 4200 * 100);
    expect(p.find((x) => x.date === "2026-06-03")?.amount).toBe(4200);
    expect(p.some((x) => x.amount === 999)).toBe(false);
    // Sorted by date.
    expect([...p].sort((a, b) => a.date.localeCompare(b.date))).toEqual(p);
  });

  it("spreads only through the quiz month, not up to today", () => {
    // Quiz answered in July, plan viewed in November: ytdIncome was received Jan..Jul.
    const p = payments1099({ ...profile, createdAt: "2026-07-08T10:00:00.000Z" }, [], "2026-11-14");
    expect(p.map((x) => x.date)).toEqual([
      "2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15", "2026-07-15",
    ]);
    expect(p.reduce((s, x) => s + Math.round(x.amount * 100), 0)).toBe(30000 * 100);
  });

  it("dates the quiz month's share no later than asOf, and clamps the quiz month to 2026", () => {
    const nov = payments1099({ ...profile, createdAt: "2026-11-14T09:00:00.000Z" }, [], "2026-11-14");
    expect(nov).toHaveLength(11);
    expect(nov[10].date).toBe("2026-11-14");
    // Quiz in 2027: Jan..Dec 2026.
    const feb27 = payments1099({ ...profile, createdAt: "2027-02-01T00:00:00.000Z" }, [], "2027-02-01");
    expect(feb27).toHaveLength(12);
    expect(feb27[11].date).toBe("2026-12-15");
    expect(feb27.every((x) => x.amount === 2500)).toBe(true);
    // A quiz month later than asOf (clock skew) is clamped to asOf's month; a 2025 timestamp gives January.
    expect(payments1099({ ...profile, createdAt: "2026-09-01T00:00:00.000Z" }, [], "2026-05-20")).toHaveLength(5);
    expect(payments1099({ ...profile, createdAt: "2025-12-31T23:00:00.000Z" }, [], "2026-05-20")).toHaveLength(1);
  });

  it("is only the log when nothing was received before it", () => {
    expect(payments1099({ ...profile, ytdIncome: 0 }, [entry({ amount: 50 })], "2026-07-01")).toEqual([
      { date: "2026-05-02", amount: 50 },
    ]);
  });

  it("feeds the engine the same year totals as the regular plan", () => {
    const log = [entry({ amount: 4200, date: "2026-06-03" })];
    const a = estimate(buildAnnualizedInput(profile, log, "2026-07-01"));
    const r = estimate(buildTaxInput(profile, log, "2026-07-01"));
    expect(a.safeHarbor.requiredAnnualPayment).toBeCloseTo(r.safeHarbor.requiredAnnualPayment, 2);
    expect(a.tax.total).toBeCloseTo(r.tax.total, 2);
  });
});

describe("annualized plan summary", () => {
  it("shows engine numbers side by side and the saving by the next due date for income that arrives late", () => {
    // Little early in the year, a big payment in late May: Q1 asks far less under Schedule AI.
    const lumpy: Profile = { ...profile, ytdIncome: 0, expectedIncome: 60000, priorYearTax: null, priorYearAgi: null };
    const log = [entry({ amount: 2000, date: "2026-02-10" }), entry({ amount: 30000, date: "2026-05-28" })];
    const plan = computeAnnualizedPlan(lumpy, log, "2026-04-01");
    const ai = annualized(plan.input);
    const reg = estimate(plan.input);
    expect(plan.rows.map((r) => r.annualized)).toEqual(ai.installments.map((i) => i.required));
    expect(plan.rows.map((r) => r.regular)).toEqual(reg.installments.map((i) => i.required));
    expect(plan.rows.find((r) => r.next)?.quarter).toBe(1);
    expect(plan.headline.kind).toBe("lessByNext");
    if (plan.headline.kind !== "lessByNext") return;
    expect(plan.headline.due).toBe("2026-04-15");
    expect(plan.headline.amount).toBeCloseTo(ai.installments[0].regularInstallment - ai.installments[0].required, 2);
    expect(plan.headline.amount).toBeGreaterThan(0);
  });

  it("points at an earlier due date when the next one asks the same total", () => {
    const lumpy: Profile = { ...profile, ytdIncome: 0, priorYearTax: null, priorYearAgi: null };
    const log = [entry({ amount: 1000, date: "2026-02-10" }), entry({ amount: 40000, date: "2026-10-20" })];
    const plan = computeAnnualizedPlan(lumpy, log, "2026-11-14");
    expect(plan.rows.find((r) => r.next)?.quarter).toBe(4);
    expect(plan.headline.kind).toBe("lessEarlier");
    if (plan.headline.kind !== "lessEarlier") return;
    expect(plan.headline.nextDue).toBe("2027-01-15");
    expect(["2026-04-15", "2026-06-15", "2026-09-15"]).toContain(plan.headline.due);
  });

  it("says the regular schedule is best for even income, and nothing to annualize when none is required", () => {
    const even = computeAnnualizedPlan({ ...profile, ytdIncome: 30000, expectedIncome: 30000 }, [], "2026-07-01");
    expect(even.headline.kind).toBe("regularBest");
    const none = computeAnnualizedPlan({ ...profile, ytdIncome: 1000, expectedIncome: 1000, priorYearTax: 0 }, [], "2026-07-01");
    expect(none.headline.kind).toBe("noneRequired");
  });

  it("PP-QA-02: with a past-due hero, passed $0 annualized quarters give way to one reconciliation line", () => {
    const late: Profile = { ...profile, ytdIncome: 0, expectedIncome: 40000, priorYearTax: null, priorYearAgi: null, estimatedPaid: 0 };
    const log = [entry({ amount: 40000, date: "2026-10-20" })];
    const plan = computeAnnualizedPlan(late, log, "2026-11-14");
    expect(pastDue(estimate(plan.input))?.quarters).toEqual([1, 2, 3]);
    expect(plan.rows.slice(0, 3).map((r) => r.annualized)).toEqual([0, 0, 0]);
    expect(plan.rows.map((r) => r.showAnnualized)).toEqual([false, false, false, true]);
    expect(plan.reconciliation).toBe("Under this method your Q1–Q3 requirement is lower; you’d file Form 2210 Schedule AI.");

    const html = renderToStaticMarkup(
      createElement(AnnualizedCard, { profile: late, log, asOf: "2026-11-14", pro: true, onNeedPro: () => {} }),
    );
    expect(html).toContain(ANNUALIZED_METHOD_LABEL);
    expect(html).toContain("you’d file Form 2210 Schedule AI.");
    expect(html).not.toMatch(/Annualized <\/span>\$0</);
  });

  it("PP-QA-02: no reconciliation when nothing is past due; the method label is the overseer's text", () => {
    expect(ANNUALIZED_METHOD_LABEL).toBe(
      "Annualized method: if most of your income came late in the year, the IRS lets you pay less early. Based on the payment dates you logged.",
    );
    const lumpy: Profile = { ...profile, ytdIncome: 0, expectedIncome: 60000, priorYearTax: null, priorYearAgi: null };
    const plan = computeAnnualizedPlan(lumpy, [entry({ amount: 2000, date: "2026-02-10" })], "2026-04-01");
    expect(pastDue(estimate(plan.input))).toBeNull();
    expect(plan.reconciliation).toBeNull();
    expect(plan.rows.every((r) => r.showAnnualized)).toBe(true);
  });

  it("summarize takes every number from the results passed in", () => {
    const input = buildAnnualizedInput(profile, [], "2026-07-01");
    const ai = annualized(input);
    const s = summarizeAnnualized(ai, estimate(input));
    expect(s.result).toBe(ai);
    expect(s.rows).toHaveLength(4);
  });
});

describe("csv", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("Acme, Inc.")).toBe('"Acme, Inc."');
    expect(csvField('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
    expect(csvField("cr\rhere")).toBe('"cr\rhere"');
    expect(csvField(null)).toBe("");
    expect(csvField("")).toBe("");
  });

  it("stops formula injection in text, but leaves numbers as numbers", () => {
    expect(csvField("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("-2+3")).toBe("'-2+3");
    expect(csvField("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvField("\tcmd")).toBe("'\tcmd");
    expect(csvField("=1,2")).toBe('"\'=1,2"');
    expect(csvField("a=b")).toBe("a=b");
    expect(csvField(1234.5)).toBe("1234.50");
    expect(csvField(-250)).toBe("-250.00");
    expect(csvField(Number.NaN)).toBe("");
  });

  it("joins rows with CRLF", () => {
    expect(csvRows([["a", 1], [], ["b,c"]])).toBe('a,1.00\r\n\r\n"b,c"');
  });

  it("has the log, the instalments and the breakdown, with the engine's numbers", () => {
    const log = [
      entry({ amount: 4200, payer: "=cmd|' /C calc'!A0", date: "2026-06-03", setAside: 1000.5 }),
      entry({ kind: "irs", amount: 2000, date: "2026-06-10", setAside: 0 }),
    ];
    const input = buildTaxInput(profile, log, "2026-07-01");
    const result = estimate(input);
    const csv = buildCsv({ log, result, annualized: annualized(buildAnnualizedInput(profile, log, "2026-07-01")), asOf: "2026-07-01" });
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toContain("Date,Type,Payer,Amount,Set aside");
    expect(lines).toContain(`2026-06-03,Income received,'=cmd|' /C calc'!A0,4200.00,1000.50`);
    expect(lines).toContain("2026-06-10,Estimated tax paid to IRS,,2000.00,");
    expect(lines).toContain("Quarter,Due,Required,Credited,To pay,Note,Status");
    const q1 = result.installments[0];
    expect(lines).toContain(
      `Q1,2026-04-15,${q1.required.toFixed(2)},${(q1.paymentsCredited + q1.withholdingCredited).toFixed(2)},0.00,Covered,Paid`,
    );
    expect(lines).toContain(`Total tax,${result.tax.total.toFixed(2)}`);
    expect(lines).toContain(`Self-employment tax,${result.tax.seTax.toFixed(2)}`);
    expect(lines.some((l) => l.startsWith("Annualized instalments"))).toBe(true);
    // Every line is a whole number of fields: no stray line breaks.
    expect(lines.every((l) => (l.match(/"/g)?.length ?? 0) % 2 === 0)).toBe(true);
  });
});

describe("PP-QA-11: CSV plan columns match the screen", () => {
  it("Maya (Q3 missed): pay-now is its own row, Q3 shows its unpaid part and Q4 only its own instalment", () => {
    const { profile: maya, entry: e } = buildExample("2026-11-14", new Date("2026-11-14T12:00:00Z"));
    const log = [{ ...e, id: "e", createdAt: "2026-11-14T12:00:00.000Z" }];
    const result = estimate(buildTaxInput(maya, log, "2026-11-14"));
    const lines = buildCsv({ log, result, asOf: "2026-11-14" }).slice(1).split("\r\n");
    const due = pastDue(result)!;
    const target = payTarget(result)!;
    const q3 = installmentRow(result, result.installments[2]!);
    const q4 = installmentRow(result, result.installments[3]!);
    expect(lines.find((l) => l.startsWith("Q3,"))).toContain(`,${q3.amount.toFixed(2)},"Missed, pay now",Past due`);
    expect(lines.find((l) => l.startsWith("Q4,"))).toContain(`,${q4.amount.toFixed(2)},Pay by this date,`);
    // Q4 carries only its own instalment, not the past-due lump the engine's nextDeadline includes.
    expect(q4.amount).toBeCloseTo(target.amount, 6);
    expect(result.nextDeadline!.amountDue).toBeGreaterThan(q4.amount + 1);
    expect(lines).toContain("Payment,When,Amount");
    expect(lines).toContain(`Missed Q3 payment,Now (past due),${due.amount.toFixed(2)}`);
    expect(lines).toContain(`Next quarterly payment (Q4),2027-01-15,${target.amount.toFixed(2)}`);
  });
});

describe("free-limit counter", () => {
  it("only goes up: deleting an entry doesn't free a slot", () => {
    let added = 0;
    let len = 0;
    for (let i = 0; i < 3; i++) {
      added = nextAdded(added, len);
      len++;
    }
    expect(entriesUsed(added, len)).toBe(3);
    len = 1; // two deleted
    expect(entriesUsed(added, len)).toBe(3);
    expect(needsPro(entriesUsed(added, len), false)).toBe(true);
    expect(needsPro(entriesUsed(added, len), true)).toBe(false);
  });

  it("A6: counts only \"I got paid\" entries, never IRS payments", () => {
    const log = [{ kind: "income" as const }, { kind: "irs" as const }, { kind: "irs" as const }, { kind: "income" as const }];
    expect(countedEntries(log)).toBe(2);
    expect(entriesUsed(0, countedEntries(log))).toBe(2);
    expect(needsPro(entriesUsed(0, countedEntries([...log, { kind: "irs" as const }])), false)).toBe(false);
  });

  it("counts entries a log started with (the example's), and never less than the log", () => {
    expect(entriesUsed(0, 1)).toBe(1);
    expect(nextAdded(0, 1)).toBe(2);
    expect(entriesUsed(2, 5)).toBe(5);
  });
});

describe("store counter", () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    Object.assign(globalThis, {
      window: {
        localStorage: {
          getItem: (k: string) => data.get(k) ?? null,
          setItem: (k: string, v: string) => void data.set(k, v),
          removeItem: (k: string) => void data.delete(k),
        },
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });

  it("persists pp.v1.added through deletes and resets it with a new log", async () => {
    const store = await import("@/lib/product/store");
    store.resetAll();
    store.setProfile(profile, { log: [{ kind: "income", amount: 1, payer: "", date: "2026-05-01", setAside: 0 }] });
    expect(store.getAddedCount()).toBe(1);
    const a = store.addLogEntry({ kind: "income", amount: 2, payer: "", date: "2026-05-02", setAside: 0 });
    const b = store.addLogEntry({ kind: "irs", amount: 3, payer: "", date: "2026-05-03", setAside: 0 });
    // A6: IRS payments are free, only "I got paid" entries count.
    expect(store.getAddedCount()).toBe(2);
    const c = store.addLogEntry({ kind: "income", amount: 4, payer: "", date: "2026-05-04", setAside: 0 });
    expect(store.getAddedCount()).toBe(3);
    store.removeLogEntry(a.id);
    store.removeLogEntry(b.id);
    store.removeLogEntry(c.id);
    expect(store.getLog()).toHaveLength(1);
    expect(store.getAddedCount()).toBe(3);
    expect(data.get(store.STORAGE_KEYS.added)).toBe("3");
    store.setProfile(profile); // keeps the log and the count
    expect(store.getAddedCount()).toBe(3);
    store.setProfile(profile, { log: [] });
    expect(store.getAddedCount()).toBe(0);
    data.set(store.STORAGE_KEYS.added, "garbage");
    expect(store.getAddedCount()).toBe(0);
  });
});
