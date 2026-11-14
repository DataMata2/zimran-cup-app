import { describe, expect, it, vi } from "vitest";
import { estimate, toICS, type TaxResult } from "@/lib/tax";
import { buildTaxInput } from "@/lib/product/input";
import { computePlan, FREE_LOG_LIMIT, needsPro, planNotes } from "@/lib/product/plan";
import { missedRemaining, nextStepText, pastDue, payTarget } from "@/lib/product/payNow";
import { calendarFile, ICS_FILENAME } from "@/lib/product/calendar";
import { CHECKOUT_ERROR, refreshPro, startCheckout } from "@/lib/product/pro";
import { dateList, shortDate } from "@/lib/product/format";
import type { Profile } from "@/lib/product/types";

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
  it("is the engine's calendar for the plan, with the return due date, and no income figures", () => {
    const result = estimate(buildTaxInput(profile, [], "2026-11-14"));
    const ics = calendarFile(result);
    expect(ics).toBe(toICS(result, { includeReturnDue: true }));
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
    expect(q1).toEqual({ amount: 1850, note: "Covered" });
    expect(q2).toEqual({ amount: 1850, note: "Covered" });
    expect(q3!.note).toBe("Missed, pay now");
    expect(q3!.amount).toBeCloseTo(1850, 6);
    expect(q4!.note).toBe("Pay by this date");
    expect(q4!.amount).toBeCloseTo(1850, 6);
    expect(q3!.amount + q4!.amount).toBeCloseTo(result.nextDeadline!.amountDue, 6);
  });
});
