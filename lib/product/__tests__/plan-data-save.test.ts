// SH-06: PUT /api/plan-data checks what it saves. Rejections first, then round trips of data the client
// itself builds (quiz → profile, payment log form → store → sync body) through the real handler.
import { beforeEach, describe, expect, it } from "vitest";
import { estimate } from "@/lib/tax";
import { RateLimiter } from "@/lib/product/ai-guard";
import { todayIso } from "@/lib/product/asof";
import { buildExample } from "@/lib/product/example";
import { buildTaxInput } from "@/lib/product/input";
import { latestLogDate, logDateError, setAsideAfterLogging } from "@/lib/product/plan";
import { parsePlanData, planDataSaveError, syncBody } from "@/lib/product/planData";
import { getPlanData, putPlanData, type PlanDataDeps } from "@/lib/product/planDataHandlers";
import { draftToProfile, emptyDraft, type QuizDraft } from "@/lib/product/quiz";
import { addLogEntry, getPlanSnapshot, getProfile, resetAll, setProfile } from "@/lib/product/store";
import type { LogEntry, LogKind, Profile } from "@/lib/product/types";
import { latestClientToday } from "@/lib/product/validate";

const data = new Map<string, string>();
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

/** Server clock: 09:00 UTC on Nov 15, 2026. */
const NOW = new Date("2026-11-15T09:00:00Z");
const AS_OF = "2026-11-15";

const profile: Profile = {
  filingStatus: "single", state: "CA", ytdIncome: 52000, expectedIncome: 64000, w2Wages: 0, w2Withholding: 0,
  priorYearTax: 7400, priorYearAgi: 49000, estimatedPaid: 3700, createdAt: "2026-11-14T00:00:00.000Z", isExample: false,
};
const entry: LogEntry = {
  id: "a1", kind: "income", amount: 4200, payer: "Northwind", date: "2026-11-03", setAside: 961.8, createdAt: "2026-11-14T00:00:00.000Z",
};

function deps(now: Date = NOW): PlanDataDeps & { saved: unknown[] } {
  const saved: unknown[] = [];
  return {
    saved,
    getGuestId: async () => "g1",
    getOrCreateGuestId: async () => "g1",
    load: async () => null,
    save: async (_id, d) => void saved.push(d),
    limiter: new RateLimiter(10_000),
    ipLimiter: new RateLimiter(10_000),
    log: () => {},
    now: () => now,
  };
}
const put = (body: unknown) =>
  new Request("http://x/api/plan-data", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) });

async function status(body: unknown, now: Date = NOW): Promise<{ status: number; error?: string }> {
  const res = await putPlanData(put(body), deps(now));
  const json = (await res.json()) as { error?: string };
  return { status: res.status, error: json.error };
}
const withEntry = (over: Partial<LogEntry>) => ({ profile, log: [{ ...entry, ...over }], added: 1 });
const withProfile = (over: Partial<Profile>) => ({ profile: { ...profile, ...over }, log: [], added: 0 });

describe("SH-06: PUT /api/plan-data rejects data the client can't create (400 + short error)", () => {
  it("baseline: the plain plan saves", async () => {
    expect((await status(withEntry({}))).status).toBe(200);
  });

  it("negative, zero and non-finite amounts", async () => {
    for (const amount of [-1000, 0, -0.01]) {
      const r = await status(withEntry({ amount }));
      expect(r.status, String(amount)).toBe(400);
      expect(r.error).toBe("Log entry amount must be more than 0.");
    }
    for (const amount of [1e9, 1e300]) expect((await status(withEntry({ amount }))).error).toBe("Log entry amount is out of range.");
    // JSON has no NaN / Infinity: they arrive as null and fail the shape check.
    expect((await status(withEntry({ amount: Number.NaN }))).status).toBe(400);
    expect((await status(withEntry({ amount: Number.POSITIVE_INFINITY }))).status).toBe(400);
    expect((await status(withEntry({ setAside: -1 }))).status).toBe(400);
    for (const f of ["ytdIncome", "expectedIncome", "w2Wages", "w2Withholding", "estimatedPaid", "priorYearTax", "priorYearAgi"]) {
      expect((await status(withProfile({ [f]: -1 }))).status, f).toBe(400);
      expect((await status(withProfile({ [f]: 1e9 }))).status, f).toBe(400);
    }
  });

  it("malformed dates", async () => {
    for (const date of ["not-a-date", "", "2026-02-30", "2026-13-01", "2026-1-5", "2026-11-03T00:00:00Z", "11/03/2026"]) {
      const r = await status(withEntry({ date }));
      expect(r.status, date).toBe(400);
      expect(r.error).toBe("Log entry has a malformed date.");
    }
    expect((await status(withEntry({ createdAt: "yesterday" }))).status).toBe(400);
    expect((await status(withProfile({ createdAt: "garbage" }))).status).toBe(400);
  });

  it("dates outside the client's range: before 2026, after today + 1 day, income after Dec 31, 2026", async () => {
    for (const kind of ["income", "irs"] as const) {
      expect((await status(withEntry({ kind, date: "2025-12-31" }))).error).toBe("Log entry date is out of range.");
      expect((await status(withEntry({ kind, date: "2026-11-17" }))).status, kind).toBe(400);
      // +1 day of slack for the client's time zone.
      expect((await status(withEntry({ kind, date: "2026-11-16" }))).status, kind).toBe(200);
    }
    const lateApril = new Date("2027-04-20T09:00:00Z");
    expect((await status(withEntry({ kind: "income", date: "2027-01-02" }), lateApril)).status).toBe(400);
    expect((await status(withEntry({ kind: "income", date: "2026-12-31" }), lateApril)).status).toBe(200);
    expect((await status(withEntry({ kind: "irs", date: "2027-04-15" }), lateApril)).status).toBe(200);
    expect((await status(withEntry({ kind: "irs", date: "2027-04-16" }), lateApril)).status).toBe(400);
  });

  it("unknown kinds and malformed rows or profiles", async () => {
    expect((await status(withEntry({ kind: "refund" as LogKind }))).status).toBe(400);
    expect((await status({ profile, log: [{ ...entry, amount: "4200" }], added: 1 })).status).toBe(400);
    expect((await status({ profile, log: ["x"], added: 1 })).status).toBe(400);
    expect((await status({ profile, log: {}, added: 0 })).status).toBe(400);
    expect((await status(withEntry({ id: "" }))).status).toBe(400);
    expect((await status(withProfile({ state: "ZZ" as Profile["state"] }))).status).toBe(400);
    expect((await status(withProfile({ filingStatus: "married" as Profile["filingStatus"] }))).status).toBe(400);
    expect((await status(withProfile({ ytdIncome: "52000" as unknown as number }))).status).toBe(400);
    expect((await status({ profile, log: [], added: -1 })).status).toBe(400);
  });

  it("oversized strings", async () => {
    expect((await status(withEntry({ payer: "x".repeat(201) }))).error).toBe("Log entry payer is too long.");
    expect((await status(withEntry({ id: "x".repeat(101) }))).status).toBe(400);
    expect((await status(withEntry({ createdAt: `2026-11-14T00:00:00.000Z${" ".repeat(40)}` }))).status).toBe(400);
    expect((await status(withProfile({ createdAt: "x".repeat(41) }))).status).toBe(400);
  });

  it("nothing is saved when a row is rejected", async () => {
    const d = deps();
    expect((await putPlanData(put(withEntry({ amount: -1 })), d)).status).toBe(400);
    expect(d.saved).toEqual([]);
  });
});

describe("SH-06: what the client creates still saves", () => {
  beforeEach(() => {
    data.clear();
    resetAll();
  });

  /** A finished quiz draft (what /start saves), with overrides. */
  const draft = (over: Partial<QuizDraft>): QuizDraft => ({
    ...emptyDraft(), filingStatus: "mfj", state: "NY", ytdIncome: 41234.56, expectedIncome: 80000.01, hasW2: true,
    w2Wages: 30000.5, w2Withholding: 2500.25, priorKnown: true, priorYearTax: 9100.99, priorYearAgi: 88000, estimatedPaid: 1234.5,
    ...over,
  });

  /** Log through the store exactly as PaymentLog.tsx does, after the form's own date check. */
  function logAsForm(kind: LogKind, amount: number, date: string, payer: string, asOf: string) {
    expect(logDateError(kind, date, asOf), `${kind} ${date}`).toBeNull();
    const p = getProfile()!;
    const before = estimate(buildTaxInput(p, getPlanSnapshot().log, asOf));
    const setAside = kind === "income" ? setAsideAfterLogging(p, getPlanSnapshot().log, { amount, date }, asOf, before).setAside : 0;
    addLogEntry({ kind, amount, payer: kind === "income" ? payer.trim().slice(0, 60) : "", date, setAside });
  }

  /** The sync's PUT body for the current local state, through the real handler, then read back by GET. */
  async function roundTrip(now: Date = NOW) {
    const body = syncBody(getPlanSnapshot());
    expect(body).not.toBeNull();
    const d = deps(now);
    const res = await putPlanData(put(body), d);
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    const back = await (await getPlanData({ ...d, load: async () => d.saved[0] })).json();
    expect(back.data.profile).toEqual(getPlanSnapshot().profile);
    expect(back.data.log).toEqual(getPlanSnapshot().log);
  }

  it("quiz profiles: cents, prior year unknown (null), no W-2, zero paid, zero YTD", async () => {
    const drafts = [
      draft({}),
      draft({ priorKnown: false, priorYearTax: null, priorYearAgi: null }),
      draft({ hasW2: false, w2Wages: null, w2Withholding: null, estimatedPaid: 0, ytdIncome: 0 }),
      draft({ ytdIncome: 999_999_999.99, expectedIncome: 999_999_999.99, w2Wages: 999_999_999.99, w2Withholding: 0 }),
    ];
    for (const dr of drafts) {
      const p = draftToProfile(dr, NOW)!;
      expect(p).not.toBeNull();
      setProfile(p);
      await roundTrip();
    }
  });

  it("an edited profile with logged income (ytdIncome taken back to 0) saves", async () => {
    setProfile(draftToProfile(draft({}), NOW)!);
    logAsForm("income", 41234.56, "2026-10-01", "Acme", AS_OF);
    const p = draftToProfile(draft({ editing: true, loggedIncome: 41234.56 }), NOW)!;
    expect(p.ytdIncome).toBe(0);
    setProfile(p);
    await roundTrip();
  });

  it("the example persona and its pre-logged payment pass the save check", async () => {
    const { profile: maya, entry: e } = buildExample(AS_OF, NOW);
    const parsed = parsePlanData({ profile: maya, log: [{ ...e, id: "x1", createdAt: NOW.toISOString() }], added: 1 })!;
    expect(parsed).not.toBeNull();
    expect(planDataSaveError(parsed, NOW)).toBeNull();
    // The sync never sends the example; saved as a real plan (isExample false) it goes through the handler too.
    setProfile({ ...maya, isExample: false }, { log: [e] });
    await roundTrip();
  });

  it("back-dated IRS payments, cents, empty payers, every allowed date edge", async () => {
    setProfile(draftToProfile(draft({}), NOW)!);
    logAsForm("irs", 0.01, "2026-01-01", "", AS_OF);
    logAsForm("irs", 1850.37, "2026-04-15", "", AS_OF);
    logAsForm("irs", 2000, AS_OF, "", AS_OF);
    logAsForm("income", 0.5, "2026-01-01", "", AS_OF);
    logAsForm("income", 99_999_999.99, AS_OF, "   ", AS_OF);
    logAsForm("income", 1200.1, "2026-06-30", "A".repeat(80), AS_OF);
    await roundTrip();
  });

  it("2027 dates the client allows: IRS up to Apr 15, 2027, income up to Dec 31, 2026", async () => {
    const lateApril = new Date("2027-04-15T23:30:00Z");
    const asOf = todayIso(lateApril);
    expect(latestLogDate("income", asOf)).toBe("2026-12-31");
    setProfile(draftToProfile(draft({}), lateApril)!);
    logAsForm("irs", 4000, "2027-01-15", "", asOf);
    logAsForm("irs", 4000.99, "2027-04-15", "", asOf);
    logAsForm("income", 3000, "2026-12-31", "Late client", asOf);
    await roundTrip(lateApril);
  });

  it("time zones: a client ahead of UTC may log its local today; a client behind UTC is always fine", async () => {
    // 23:30 UTC on Nov 14 is already Nov 15 in Astana and Kiribati (UTC+14).
    const server = new Date("2026-11-14T23:30:00Z");
    expect(latestClientToday(server)).toBe("2026-11-15");
    setProfile(draftToProfile(draft({}), server)!);
    logAsForm("irs", 500, "2026-11-15", "", "2026-11-15");
    logAsForm("income", 500, "2026-11-15", "", "2026-11-15");
    await roundTrip(server);
  });

  it("a profile shape-valid before SH-06 but now out of range still LOADS (read path is not checked)", async () => {
    const old = { v: 1, profile, log: [{ ...entry, amount: -1000 }, { ...entry, id: "b", date: "2026-12-30" }], added: 2 };
    const res = await getPlanData({ ...deps(), load: async () => old });
    expect((await res.json()).data).toEqual(old);
  });
});
