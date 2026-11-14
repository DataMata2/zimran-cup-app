import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "@/lib/product/ai-guard";
import {
  clearedBody, isClearedPlan, isLocalEmpty, parsePlanData, PLAN_DATA_MAX_BYTES, shouldRestore, syncBody, type PlanData,
} from "@/lib/product/planData";
import { getPlanData, putPlanData, type PlanDataDeps } from "@/lib/product/planDataHandlers";
import {
  clearSavedCopy, resetSyncStateForTests, restoreIfEmpty, startSync, SYNC_DEBOUNCE_MS, type SyncDeps,
} from "@/lib/product/sync";
import type { LogEntry, Profile } from "@/lib/product/types";

const profile: Profile = {
  filingStatus: "single", state: "CA", ytdIncome: 52000, expectedIncome: 64000, w2Wages: 0, w2Withholding: 0,
  priorYearTax: 7400, priorYearAgi: 49000, estimatedPaid: 3700, createdAt: "2026-11-14T00:00:00.000Z", isExample: false,
};
const entry: LogEntry = {
  id: "a1", kind: "income", amount: 4200, payer: "Northwind", date: "2026-11-03", setAside: 961.8, createdAt: "2026-11-14T00:00:00.000Z",
};
const stored: PlanData = { v: 1, profile, log: [entry], added: 3 };

describe("parsePlanData", () => {
  it("accepts a valid body and a stored copy, and drops unknown fields", () => {
    expect(parsePlanData({ profile, log: [entry], added: 3 })).toEqual(stored);
    expect(parsePlanData(stored)).toEqual(stored);
    const extra = parsePlanData({ profile: { ...profile, evil: 1 }, log: [{ ...entry, x: "y" }], added: 3, junk: true });
    expect(extra).toEqual(stored);
  });

  it("never lets added be below the log length, and defaults it to the log length", () => {
    expect(parsePlanData({ profile, log: [entry, { ...entry, id: "b" }], added: 1 })?.added).toBe(2);
    expect(parsePlanData({ profile, log: [entry] })?.added).toBe(1);
  });

  it("accepts a cleared plan, rejects a log without a profile", () => {
    expect(parsePlanData({ profile: null, log: [], added: 0 })).toEqual({ v: 1, profile: null, log: [], added: 0 });
    expect(parsePlanData({ profile: null, log: [entry], added: 1 })).toBeNull();
  });

  it("rejects malformed data", () => {
    for (const bad of [
      null, [], "x", 1,
      { profile, log: [entry], added: 3, v: 2 },
      { profile: { ...profile, state: "ZZ" }, log: [], added: 0 },
      { profile: { ...profile, ytdIncome: "1" }, log: [], added: 0 },
      { profile, log: [{ ...entry, kind: "gift" }], added: 1 },
      { profile, log: "nope", added: 0 },
      { profile, log: [], added: -1 },
      { profile, log: [], added: 1.5 },
      { profile, log: [], added: "3" },
      { log: [], added: 0 },
    ]) {
      expect(parsePlanData(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("merge rule", () => {
  it("restores only into an empty browser, and only a real plan", () => {
    const empty = { profile: null, log: [] };
    expect(isLocalEmpty(empty)).toBe(true);
    expect(shouldRestore(empty, stored)).toBe(true);
    expect(shouldRestore(empty, null)).toBe(false);
    expect(shouldRestore(empty, { v: 1, profile: null, log: [], added: 0 })).toBe(false);
    // Local wins when both exist.
    expect(shouldRestore({ profile, log: [] }, stored)).toBe(false);
    expect(shouldRestore({ profile: null, log: [entry] }, stored)).toBe(false);
    // An example copy is never restored.
    expect(shouldRestore(empty, { ...stored, profile: { ...profile, isExample: true } })).toBe(false);
  });

  it("never sends the example or an empty plan; clearing only a real plan", () => {
    expect(JSON.parse(syncBody({ profile, log: [entry], added: 3 }) ?? "null")).toEqual({ profile, log: [entry], added: 3 });
    expect(syncBody({ profile: { ...profile, isExample: true }, log: [entry], added: 1 })).toBeNull();
    expect(syncBody({ profile: null, log: [], added: 0 })).toBeNull();
    expect(JSON.parse(clearedBody({ profile }) ?? "null")).toEqual({ profile: null, log: [], added: 0 });
    expect(clearedBody({ profile: { ...profile, isExample: true } })).toBeNull();
    expect(clearedBody({ profile: null })).toBeNull();
    expect(isClearedPlan({ profile: null, log: [] })).toBe(true);
    expect(isClearedPlan({ profile, log: [] })).toBe(false);
  });
});

function deps(over: Partial<PlanDataDeps> = {}): PlanDataDeps & { saved: unknown[] } {
  const saved: unknown[] = [];
  return {
    saved,
    getGuestId: async () => "g1",
    getOrCreateGuestId: async () => "g1",
    load: async () => stored,
    save: async (_id, d) => void saved.push(d),
    limiter: new RateLimiter(100),
    ipLimiter: new RateLimiter(100),
    log: () => {},
    ...over,
  };
}
const put = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x/api/plan-data", {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "x-forwarded-for": "203.0.113.9", ...headers },
  });

describe("/api/plan-data handlers", () => {
  it("GET returns the validated copy, null without a guest or for a malformed copy, no-store", async () => {
    let res = await getPlanData(deps());
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: stored });
    expect(await (await getPlanData(deps({ getGuestId: async () => null }))).json()).toEqual({ data: null });
    expect(await (await getPlanData(deps({ load: async () => null }))).json()).toEqual({ data: null });
    expect(await (await getPlanData(deps({ load: async () => ({ profile: 1 }) }))).json()).toEqual({ data: null });
    res = await getPlanData(deps({ load: async () => { throw new Error("db down"); } }));
    expect(res.status).toBe(503);
  });

  it("GET only reads the cookie's own guest", async () => {
    const load = vi.fn(async () => stored);
    await getPlanData(deps({ getGuestId: async () => "mine", load }));
    expect(load).toHaveBeenCalledWith("mine");
  });

  it("PUT validates and saves {v:1, profile, log, added} for the cookie's guest", async () => {
    const d = deps({ getOrCreateGuestId: async () => "mine" });
    const save = vi.spyOn(d, "save");
    const res = await putPlanData(put({ profile, log: [entry], added: 3, guestId: "someone-else" }), d);
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalledWith("mine", stored);
  });

  it("PUT rejects a malformed body (400), a non-JSON body (400) and a body over 64 KB (413) without saving", async () => {
    const d = deps();
    expect((await putPlanData(put({ profile: null, log: [entry] }), d)).status).toBe(400);
    expect((await putPlanData(put("not json"), d)).status).toBe(400);
    const big = { profile, log: [{ ...entry, payer: "x".repeat(PLAN_DATA_MAX_BYTES) }], added: 1 };
    expect((await putPlanData(put(big), d)).status).toBe(413);
    expect((await putPlanData(put("{}", { "content-length": String(PLAN_DATA_MAX_BYTES + 1) }), d)).status).toBe(413);
    expect(d.saved).toHaveLength(0);
  });

  it("PUT checks the IP limit before anything else, and never creates a guest over it", async () => {
    const getOrCreateGuestId = vi.fn(async () => "g1");
    const d = deps({ ipLimiter: new RateLimiter(1), getOrCreateGuestId });
    expect((await putPlanData(put(stored), d)).status).toBe(200);
    expect((await putPlanData(put(stored), d)).status).toBe(429);
    // Even a malformed body is refused by the IP limit first.
    expect((await putPlanData(put("not json"), d)).status).toBe(429);
    expect(getOrCreateGuestId).toHaveBeenCalledTimes(1);
    // Another IP still has its own budget.
    expect((await putPlanData(put(stored, { "x-forwarded-for": "198.51.100.1" }), d)).status).toBe(200);
  });

  it("PUT of a cleared plan without a guest cookie is a 200 no-op; with a cookie it clears that guest's copy", async () => {
    const getOrCreateGuestId = vi.fn(async () => "new");
    const noCookie = deps({ getGuestId: async () => null, getOrCreateGuestId });
    const res = await putPlanData(put({ profile: null, log: [], added: 0 }), noCookie);
    expect(res.status).toBe(200);
    expect(getOrCreateGuestId).not.toHaveBeenCalled();
    expect(noCookie.saved).toHaveLength(0);
    const withCookie = deps({ getGuestId: async () => "mine", getOrCreateGuestId });
    expect((await putPlanData(put({ profile: null, log: [], added: 0 }), withCookie)).status).toBe(200);
    expect(withCookie.saved).toEqual([{ v: 1, profile: null, log: [], added: 0 }]);
    expect(getOrCreateGuestId).not.toHaveBeenCalled();
  });

  it("PUT answers 503 when saving fails and 429 over the rate limit", async () => {
    expect((await putPlanData(put(stored), deps({ save: async () => { throw new Error("unconfigured"); } }))).status).toBe(503);
    const d = deps({ limiter: new RateLimiter(1) });
    expect((await putPlanData(put(stored), d)).status).toBe(200);
    expect((await putPlanData(put(stored), d)).status).toBe(429);
  });
});

describe("client sync", () => {
  let local: { profile: Profile | null; log: readonly LogEntry[]; added: number };
  let listeners: (() => void)[];
  let calls: { url: string; init?: RequestInit }[];
  let respond: () => Promise<Response>;

  const syncDeps = (): SyncDeps => ({
    fetch: (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return respond();
    }) as typeof fetch,
    snapshot: () => local,
    restore: (d) => {
      local = { profile: d.profile, log: d.log, added: d.added };
      listeners.forEach((l) => l());
    },
    onChange: (l) => {
      listeners.push(l);
      return () => (listeners = listeners.filter((x) => x !== l));
    },
    onPageHide: (f) => {
      hide = f;
      return () => (hide = null);
    },
    warn: () => {},
  });
  let hide: (() => void) | null;

  beforeEach(() => {
    resetSyncStateForTests();
    hide = null;
    local = { profile: null, log: [], added: 0 };
    listeners = [];
    calls = [];
    respond = async () => Response.json({ data: stored });
  });
  afterEach(() => vi.useRealTimers());

  it("restores the server copy into an empty browser", async () => {
    expect(await restoreIfEmpty(syncDeps())).toBe("restored");
    expect(local).toEqual({ profile, log: [entry], added: 3 });
  });

  it("does not fetch or restore when local has data, and stays silent on failures", async () => {
    local = { profile, log: [], added: 0 };
    expect(await restoreIfEmpty(syncDeps())).toBe("local");
    expect(calls).toHaveLength(0);
    local = { profile: null, log: [], added: 0 };
    respond = async () => { throw new Error("offline"); };
    expect(await restoreIfEmpty(syncDeps())).toBe("failed");
    respond = async () => new Response("", { status: 503 });
    expect(await restoreIfEmpty(syncDeps())).toBe("failed");
    respond = async () => Response.json({ data: { profile: "bad" } });
    expect(await restoreIfEmpty(syncDeps())).toBe("none");
    respond = async () => Response.json({ data: { ...stored, profile: { ...profile, isExample: true } } });
    expect(await restoreIfEmpty(syncDeps())).toBe("none");
    expect(local.profile).toBeNull();
  });

  it("debounces a PUT 1 s after the last change and flushes a pending one on stop", async () => {
    vi.useFakeTimers();
    respond = async () => Response.json({ ok: true });
    local = { profile, log: [entry], added: 1 };
    const stop = startSync(syncDeps());
    listeners.forEach((l) => l());
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS - 10);
    listeners.forEach((l) => l());
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS - 10);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(20);
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe("PUT");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ profile, log: [entry], added: 1 });
    // Nothing changed: no second PUT.
    listeners.forEach((l) => l());
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    expect(calls).toHaveLength(1);
    // A pending save goes out right away (keepalive) when the page is hidden.
    local = { profile, log: [entry, { ...entry, id: "b" }], added: 2 };
    listeners.forEach((l) => l());
    hide?.();
    expect(calls).toHaveLength(2);
    expect(calls[1].init?.keepalive).toBe(true);
    // An emptied local store (Start over) is never sent by the sync, even on stop.
    local = { profile: null, log: [], added: 0 };
    listeners.forEach((l) => l());
    stop();
    expect(calls).toHaveLength(2);
    expect(listeners).toHaveLength(0);
    expect(hide).toBeNull();
  });

  it("never sends the example persona", async () => {
    vi.useFakeTimers();
    local = { profile: { ...profile, isExample: true }, log: [entry], added: 1 };
    const stop = startSync(syncDeps());
    listeners.forEach((l) => l());
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS * 3);
    hide?.();
    stop();
    expect(calls).toHaveLength(0);
  });

  it("Start over clears a real copy and stops restoring for the tab; on the example it sends nothing", async () => {
    respond = async () => Response.json({ ok: true });
    local = { profile: { ...profile, isExample: true }, log: [entry], added: 1 };
    clearSavedCopy(syncDeps());
    expect(calls).toHaveLength(0);
    local = { profile, log: [entry], added: 1 };
    clearSavedCopy(syncDeps());
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ profile: null, log: [], added: 0 });
    expect(calls[0].init?.keepalive).toBe(true);
    local = { profile: null, log: [], added: 0 };
    respond = async () => Response.json({ data: stored });
    expect(await restoreIfEmpty(syncDeps())).toBe("none");
    expect(calls).toHaveLength(1);
  });
});
