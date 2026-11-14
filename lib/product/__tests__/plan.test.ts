import { describe, expect, it, vi } from "vitest";
import { estimate, estimateAccruedPenalty, type TaxResult } from "@/lib/tax";
import { buildTaxInput } from "@/lib/product/input";
import { computePlan, defaultIrsDate, FREE_LOG_LIMIT, logDateError, needsPro, planNotes } from "@/lib/product/plan";
import { buildCsv } from "@/lib/product/csv";
import { isLogEntry } from "@/lib/product/validate";
import { penaltyMeter } from "@/lib/product/meter";
import { missedRemaining, nextStepText, pastDue, payTarget } from "@/lib/product/payNow";
import { calendarFile, ICS_FILENAME } from "@/lib/product/calendar";
import { CHECKOUT_ERROR, refreshPro, startCheckout } from "@/lib/product/pro";
import { dateList, shortDate } from "@/lib/product/format";
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

describe("pastDue", () => {
  it("sums every missed instalment (the cumulative shortfall), not just the last one", () => {
    // Nothing paid by Nov 14: Q1, Q2 and Q3 are all past due.
    const result = estimate(buildTaxInput(profile, [], "2026-11-14"));
    const missed = result.installments.filter((i) => i.status === "pastDue");
    expect(missed.length).toBe(3);
    const part = pastDue(result);
    expect(part?.dues).toEqual(missed.map((i) => i.due));
    expect(part?.quarters).toEqual([1, 2, 3]);
    expect(part?.amount).toBe(Math.max(...missed.map((i) => i.shortfall)));
    expect(part?.amount).toBe(missed.reduce((s, i) => s + i.required, 0));
    expect(result.nextDeadline?.amountDue).toBeGreaterThan(part!.amount);
  });

  it("is null when nothing is past due", () => {
    const result = estimate(buildTaxInput({ ...profile, estimatedPaid: 6000 }, [], "2026-11-14"));
    expect(result.nextDeadline?.includesPastDue).toBe(false);
    expect(pastDue(result)).toBeNull();
  });

  it("ignores a past-due shortfall under 50 cents (it would read as $0)", () => {
    const fake = {
      installments: [{ quarter: 3, due: "2026-09-15", shortfall: 0.3, status: "pastDue" }],
      nextDeadline: null,
    } as unknown as TaxResult;
    expect(pastDue(fake)).toBeNull();
  });
});

describe("missedRemaining", () => {
  it("is each missed quarter's own unpaid part, adding up to the past-due total", () => {
    const result = estimate(buildTaxInput(profile, [], "2026-11-14"));
    const parts = ([1, 2, 3] as const).map((q) => missedRemaining(result, q));
    for (const p of parts) expect(p).toBeCloseTo(result.installments[0]!.required, 6);
    expect(parts.reduce((s, p) => s + p, 0)).toBeCloseTo(pastDue(result)!.amount, 6);
  });

  it("shows only the unpaid rest of a partly paid quarter", () => {
    // $1,000 paid: it goes to Q1 first, so Q1 still lacks required − 1,000 and Q2, Q3 lack their full amount.
    const result = estimate(buildTaxInput({ ...profile, estimatedPaid: 1000 }, [], "2026-11-14"));
    const req = result.installments[0]!.required;
    expect(missedRemaining(result, 1)).toBeCloseTo(req - 1000, 6);
    expect(missedRemaining(result, 2)).toBeCloseTo(req, 6);
  });
});

describe("payTarget", () => {
  it("is the next instalment on its own, without the past-due part", () => {
    const result = estimate(buildTaxInput(profile, [], "2026-11-14"));
    expect(payTarget(result)).toEqual({
      quarter: 4, due: "2027-01-15", amount: result.nextDeadline!.amountDue - pastDue(result)!.amount, isNext: true,
    });
    expect(payTarget(result)!.amount).toBeCloseTo(result.installments[3]!.required, 6);
  });

  it("is the full next deadline when nothing is past due", () => {
    const result = estimate(buildTaxInput({ ...profile, estimatedPaid: 6000 }, [], "2026-11-14"));
    expect(payTarget(result)?.amount).toBe(result.nextDeadline!.amountDue);
  });

  it("is null when the year's target is already paid", () => {
    const result = estimate(buildTaxInput({ ...profile, estimatedPaid: 8000 }, [], "2026-11-14"));
    expect(payTarget(result)).toBeNull();
  });

  it("skips a $0 next deadline to the first later planned payment", () => {
    const fake = {
      nextDeadline: { quarter: 2, due: "2026-06-15", amountDue: 0, includesPastDue: false },
      installments: [
        { quarter: 3, due: "2026-09-15", plannedPayment: 0 },
        { quarter: 4, due: "2027-01-15", plannedPayment: 900 },
      ],
    } as unknown as TaxResult;
    expect(payTarget(fake)).toEqual({ quarter: 4, due: "2027-01-15", amount: 900, isNext: false });
  });

  it("treats a next deadline under 50 cents as covered", () => {
    const fake = {
      nextDeadline: { quarter: 4, due: "2027-01-15", amountDue: 0.4, includesPastDue: false },
      installments: [],
    } as unknown as TaxResult;
    expect(payTarget(fake)).toBeNull();
  });
});

describe("nextStepText", () => {
  it("splits a past-due amount from the next instalment", () => {
    const result = estimate(buildTaxInput(profile, [], "2026-11-14"));
    expect(nextStepText(result)).toMatch(/^Q1–Q3 are still past due\. Pay \$[\d,]+ now, then \$[\d,]+ by Jan 15, 2027\.$/);
  });

  it("never says covered while a quarter is past due, even with no deadline left", () => {
    const fake = {
      installments: [{ quarter: 4, due: "2027-01-15", shortfall: 1200, status: "pastDue" }],
      nextDeadline: null,
    } as unknown as TaxResult;
    expect(nextStepText(fake)).toBe("Q4 is still past due. Pay $1,200 now.");
  });

  it("names the next deadline, or says the year is covered", () => {
    const onTrack = estimate(buildTaxInput({ ...profile, estimatedPaid: 6000 }, [], "2026-11-14"));
    expect(nextStepText(onTrack)).toMatch(/^Next: \$[\d,]+ by Jan 15, 2027\.$/);
    const done = estimate(buildTaxInput({ ...profile, estimatedPaid: 8000 }, [], "2026-11-14"));
    expect(nextStepText(done)).toBe("That covers your safe-harbor amount for 2026.");
  });
});

describe("computePlan", () => {
  it("returns the engine result for a valid profile", () => {
    const out = computePlan(profile, [], "2026-11-14");
    expect(out.ok).toBe(true);
  });

  it("returns the input error instead of throwing on a profile the engine rejects", () => {
    const out = computePlan({ ...profile, ytdIncome: -5 }, [], "2026-11-14");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.field).toBe("ytd1099Income");
  });
});

describe("free tier and notes", () => {
  it("needs Pro from the fourth entry, never for Pro users", () => {
    expect(FREE_LOG_LIMIT).toBe(3);
    expect(needsPro(2, false)).toBe(false);
    expect(needsPro(3, false)).toBe(true);
    expect(needsPro(10, true)).toBe(false);
  });

  it("dedupes flags, drops the past-due one, moves credits to the footnote", () => {
    const { notes, footnotes } = planNotes([
      { code: "state_approximate", message: "a" },
      { code: "past_due_installment", message: "b" },
      { code: "credits_not_modeled", message: "c" },
      { code: "state_approximate", message: "a again" },
    ]);
    expect(notes.map((f) => f.message)).toEqual(["a"]);
    expect(footnotes.map((f) => f.message)).toEqual(["c"]);
  });

  it("formats due-date lists", () => {
    expect(shortDate("2026-09-15")).toBe("Sep 15");
    expect(dateList(["2026-09-15"])).toBe("Sep 15, 2026");
    expect(dateList(["2026-06-15", "2026-09-15"])).toBe("Jun 15 and Sep 15, 2026");
    expect(dateList(["2026-04-15", "2026-06-15", "2026-09-15"])).toBe("Apr 15, Jun 15 and Sep 15, 2026");
    expect(dateList(["2026-09-15", "2027-01-15"])).toBe("Sep 15, 2026 and Jan 15, 2027");
  });
});

describe("calendarFile", () => {
  it("is built on the engine's calendar, with the return due date, and no income figures", () => {
    const result = estimate(buildTaxInput(profile, [], "2026-11-14"));
    const ics = calendarFile(result);
    // This profile has a past-due amount, so the file adds a pay-now event (see calendar.test.ts).
    expect(ics).toContain("UID:penaltyproof-2026-pastdue@penaltyproof");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("20270415");
    expect(ics).not.toContain("30000");
    expect(ICS_FILENAME).toBe("penaltyproof-2026.ics");
  });
});

describe("pro adapter", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("creates the guest, posts the plan and goes to the checkout URL", async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return url === "/api/guest" ? json({ guestId: "g" }) : json({ url: "https://checkout.stripe.com/c/x" });
    });
    const navigate = vi.fn();
    const out = await startCheckout("monthly", { fetch: fetchMock as unknown as typeof fetch, navigate });
    expect(out).toEqual({ ok: true });
    expect(calls.map((c) => c[0])).toEqual(["/api/guest", "/api/checkout"]);
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ plan: "monthly" });
    expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/x");
  });

  it("returns the inline error when checkout fails or the network is down", async () => {
    const navigate = vi.fn();
    const failing = vi.fn(async (url: string) =>
      url === "/api/guest" ? json({}, 500) : json({ error: "Could not start checkout" }, 500),
    );
    expect(await startCheckout("yearly", { fetch: failing as unknown as typeof fetch, navigate })).toEqual({
      ok: false, error: CHECKOUT_ERROR,
    });
    const down = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect((await startCheckout("yearly", { fetch: down as unknown as typeof fetch, navigate })).ok).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("refreshPro keeps the cached value when the server can't answer", async () => {
    // No window in this test file: the store reads nothing, isPro() is false.
    const down = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect(await refreshPro({ fetch: down as unknown as typeof fetch })).toBe(false);
    const bad = vi.fn(async () => json({ pro: "yes" }));
    expect(await refreshPro({ fetch: bad as unknown as typeof fetch })).toBe(false);
  });
});

describe("installmentRow", () => {
  it("Maya: Q3 shows its unpaid $1,850 to pay now, Q4 only its own instalment", async () => {
    const { buildExample } = await import("@/lib/product/example");
    const { installmentRow } = await import("@/lib/product/payNow");
    const { profile, entry } = buildExample("2026-11-14", new Date("2026-11-14T12:00:00Z"));
    const result = estimate(buildTaxInput(profile, [{ ...entry, id: "e", createdAt: "2026-11-14T12:00:00.000Z" }], "2026-11-14"));
    const [q1, q2, q3, q4] = result.installments.map((i) => installmentRow(result, i));
    expect(q1).toEqual({ amount: 1850, note: "Covered", amountText: "$1,850" });
    expect(q2).toEqual({ amount: 1850, note: "Covered", amountText: "$1,850" });
    expect(q3!.note).toBe("Missed, pay now");
    // Float residue stays at $1,850 when rounded up (PP-QA-08).
    expect(q3!.amountText).toBe("$1,850");
    expect(q4!.amountText).toBe("$1,850");
    expect(q3!.amount).toBeCloseTo(1850, 6);
    expect(q4!.note).toBe("Pay by this date");
    expect(q4!.amount).toBeCloseTo(1850, 6);
    expect(q3!.amount + q4!.amount).toBeCloseTo(result.nextDeadline!.amountDue, 6);
  });
});

describe("LIVE-PP-02: the IRS payment date", () => {
  const NOV15 = "2026-11-15";
  const irsOn = (date: string): LogEntry => ({
    id: `irs-${date}`, kind: "irs", amount: 2000, payer: "", date, setAside: 0, createdAt: "2026-11-15T10:00:00.000Z",
  });

  it("defaults to today, also in 2027 (no Dec 31 cap)", () => {
    expect(defaultIrsDate(NOV15)).toBe(NOV15);
    expect(defaultIrsDate("2027-02-01")).toBe("2027-02-01");
  });

  it("accepts Jan 1, 2026 through today; rejects future dates, 2025 dates and a cleared field", () => {
    for (const kind of ["irs", "income"] as const) {
      expect(logDateError(kind, "2026-01-01", NOV15)).toBeNull();
      expect(logDateError(kind, "2026-04-15", NOV15)).toBeNull();
      expect(logDateError(kind, NOV15, NOV15)).toBeNull();
      const msg = "Use a date between Jan 1, 2026 and Nov 15, 2026.";
      expect(logDateError(kind, "2026-11-16", NOV15)).toBe(msg);
      expect(logDateError(kind, "2025-12-31", NOV15)).toBe(msg);
      expect(logDateError(kind, "2027-01-10", NOV15)).toBe(msg);
      // A cleared date field is kept as "" (not snapped back to today) and rejected on submit.
      expect(logDateError(kind, "", NOV15)).toBe(msg);
    }
  });

  it("in 2027 an IRS payment may be dated up to today; income stays capped at Dec 31, 2026", () => {
    const FEB1 = "2027-02-01";
    expect(logDateError("irs", "2027-01-20", FEB1)).toBeNull();
    expect(logDateError("irs", FEB1, FEB1)).toBeNull();
    expect(logDateError("irs", "2027-02-02", FEB1)).toBe("Use a date between Jan 1, 2026 and Feb 1, 2027.");
    expect(logDateError("income", "2027-01-20", FEB1)).toBe("Use a date between Jan 1, 2026 and Dec 31, 2026.");
    expect(logDateError("income", "2026-12-31", FEB1)).toBeNull();
  });

  it("a late Q4 payment dated Jan 20, 2027 keeps its date and its penalty (vs. dated Dec 31, 2026)", () => {
    const FEB1 = "2027-02-01";
    const run = (date: string) => estimate(buildTaxInput(profile, [{ ...irsOn(date), amount: 8000 }], FEB1));
    const late = run("2027-01-20");
    expect(late.input.estimatedPaymentsMade).toEqual([{ date: "2027-01-20", amount: 8000 }]);
    const q4 = (r: TaxResult) => estimateAccruedPenalty(r).perInstallment.find((i) => i.quarter === 4)!;
    expect(q4(late).daysLate).toBeGreaterThan(0);
    expect(q4(late).penalty).toBeGreaterThan(q4(run("2026-12-31")).penalty);
  });

  it("the entry keeps its payment date (not the logging time); server validation accepts a past date", () => {
    const e = irsOn("2026-04-15");
    expect(e.date).toBe("2026-04-15");
    expect(e.createdAt.startsWith(NOV15)).toBe(true);
    expect(isLogEntry(e)).toBe(true);
  });

  it("the engine gets the date: dated Apr 15 it covers Q1 on time; dated Nov 15 Q1 was paid late", () => {
    const run = (date: string) => estimate(buildTaxInput(profile, [irsOn(date)], NOV15));
    const onTime = run("2026-04-15");
    const late = run(NOV15);
    expect(onTime.input.estimatedPaymentsMade).toEqual([{ date: "2026-04-15", amount: 2000 }]);
    expect(late.input.estimatedPaymentsMade).toEqual([{ date: NOV15, amount: 2000 }]);
    // Same total paid, so the meter's paid figure is the same...
    expect(penaltyMeter(onTime, [irsOn("2026-04-15")]).paid).toBe(penaltyMeter(late, [irsOn(NOV15)]).paid);
    // ...but the penalty differs: Q1 accrued nothing when paid Apr 15, and did when paid Nov 15.
    const q1 = (r: TaxResult) => estimateAccruedPenalty(r).perInstallment.find((i) => i.quarter === 1)!;
    expect(q1(onTime).penalty).toBe(0);
    expect(q1(late).penalty).toBeGreaterThan(0);
    expect(estimateAccruedPenalty(late).total).toBeGreaterThan(estimateAccruedPenalty(onTime).total);
  });

  it("the CSV row carries the entered date", () => {
    const log = [irsOn("2026-04-15")];
    const csv = buildCsv({ log, result: estimate(buildTaxInput(profile, log, NOV15)), asOf: NOV15 });
    expect(csv).toContain("2026-04-15,Estimated tax paid to IRS,,2000.00,");
  });
});
