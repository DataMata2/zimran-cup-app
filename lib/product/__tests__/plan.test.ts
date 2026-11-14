import { describe, expect, it, vi } from "vitest";
import { estimate, toICS, type TaxResult } from "@/lib/tax";
import { buildTaxInput } from "@/lib/product/input";
import { computePlan, FREE_LOG_LIMIT, needsPro, pastDuePart, payTarget, planNotes } from "@/lib/product/plan";
import { decodeIcsParam, encodeIcsParam, icsHref, ICS_PARAM_MAX_LENGTH } from "@/lib/product/icsParam";
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

describe("pastDuePart", () => {
  it("sums every missed instalment (the cumulative shortfall), not just the last one", () => {
    // Nothing paid by Nov 14: Q1, Q2 and Q3 are all past due.
    const result = estimate(buildTaxInput(profile, [], "2026-11-14"));
    const missed = result.installments.filter((i) => i.status === "pastDue");
    expect(missed.length).toBe(3);
    const part = pastDuePart(result);
    expect(part?.dues).toEqual(missed.map((i) => i.due));
    expect(part?.amount).toBe(Math.max(...missed.map((i) => i.shortfall)));
    expect(part?.amount).toBe(missed.reduce((s, i) => s + i.required, 0));
    expect(result.nextDeadline?.amountDue).toBeGreaterThan(part!.amount);
  });

  it("is null when nothing is past due", () => {
    const result = estimate(buildTaxInput({ ...profile, estimatedPaid: 6000 }, [], "2026-11-14"));
    expect(result.nextDeadline?.includesPastDue).toBe(false);
    expect(pastDuePart(result)).toBeNull();
  });
});

describe("payTarget", () => {
  it("is the next deadline's amount", () => {
    const result = estimate(buildTaxInput(profile, [], "2026-11-14"));
    expect(payTarget(result)).toEqual({
      quarter: 4, due: "2027-01-15", amount: result.nextDeadline!.amountDue, isNext: true,
    });
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

describe("ics param", () => {
  it("round-trips the engine input and builds the same calendar", () => {
    const input = buildTaxInput(profile, [], "2026-11-14");
    const d = encodeIcsParam(input);
    expect(d).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeIcsParam(d)).toEqual(input);
    expect(toICS(estimate(decodeIcsParam(d)!), { includeReturnDue: true })).toBe(
      toICS(estimate(input), { includeReturnDue: true }),
    );
    expect(icsHref(input)).toBe(`/api/ics?d=${d}`);
  });

  it("keeps non-ASCII text intact", () => {
    const value = { note: "Café — 東京" } as never;
    expect(decodeIcsParam(encodeIcsParam(value))).toEqual(value);
  });

  it("rejects anything that is not base64url JSON of an object", () => {
    expect(decodeIcsParam(null)).toBeNull();
    expect(decodeIcsParam("")).toBeNull();
    expect(decodeIcsParam("not base64!")).toBeNull();
    expect(decodeIcsParam(Buffer.from("not json").toString("base64url"))).toBeNull();
    expect(decodeIcsParam(Buffer.from("[1,2]").toString("base64url"))).toBeNull();
    expect(decodeIcsParam(Buffer.from("42").toString("base64url"))).toBeNull();
    expect(decodeIcsParam("A".repeat(ICS_PARAM_MAX_LENGTH + 1))).toBeNull();
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
