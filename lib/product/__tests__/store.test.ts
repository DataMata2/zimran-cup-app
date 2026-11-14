import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshPro } from "@/lib/product/pro";
import {
  addLogEntry, getLog, getProfile, hasUnreadableProfile, isPro, removeLogEntry, resetAll, setPro, setProfile, STORAGE_KEYS,
} from "@/lib/product/store";
import { EXAMPLE_ANSWERS } from "@/lib/product/example";

const data = new Map<string, string>();
let storageFull = false;
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (storageFull) throw new DOMException("QuotaExceededError");
        data.set(k, v);
      },
      removeItem: (k: string) => void data.delete(k),
    },
    addEventListener() {},
    removeEventListener() {},
  },
});

const profile = { ...EXAMPLE_ANSWERS, createdAt: "2026-11-14T00:00:00.000Z" };

describe("store", () => {
  beforeEach(() => {
    storageFull = false;
    resetAll();
  });

  it("tells unreadable saved answers apart from none", () => {
    expect(hasUnreadableProfile()).toBe(false);
    data.set(STORAGE_KEYS.profile, JSON.stringify({ filingStatus: "single" }));
    expect(getProfile()).toBeNull();
    expect(hasUnreadableProfile()).toBe(true);
    data.set(STORAGE_KEYS.profile, "{not json");
    expect(hasUnreadableProfile()).toBe(true);
    setProfile(profile);
    expect(hasUnreadableProfile()).toBe(false);
  });

  it("saves the profile and optionally replaces the log", () => {
    expect(getProfile()).toBeNull();
    setProfile(profile, { log: [{ kind: "income", amount: 4200, payer: "N", date: "2026-11-03", setAside: 900 }] });
    expect(getProfile()).toEqual(profile);
    expect(getLog()).toHaveLength(1);
    setProfile(profile);
    expect(getLog()).toHaveLength(1);
    setProfile(profile, { log: [] });
    expect(getLog()).toHaveLength(0);
  });

  it("adds and removes entries with stable snapshots", () => {
    const a = addLogEntry({ kind: "income", amount: 100, payer: "A", date: "2026-11-01", setAside: 20 });
    const b = addLogEntry({ kind: "irs", amount: 50, payer: "", date: "2026-11-02", setAside: 0 });
    expect(a.id).not.toBe(b.id);
    expect(getLog().map((e) => e.id)).toEqual([a.id, b.id]);
    expect(getLog()).toBe(getLog());
    removeLogEntry(a.id);
    expect(getLog().map((e) => e.id)).toEqual([b.id]);
  });

  it("tracks Pro and ignores corrupt data", () => {
    setPro(true);
    expect(isPro()).toBe(true);
    data.set(STORAGE_KEYS.profile, "{not json");
    expect(getProfile()).toBeNull();
    data.set(STORAGE_KEYS.log, JSON.stringify([{ id: 1 }]));
    expect(getLog()).toEqual([]);
    resetAll();
    expect(isPro()).toBe(false);
    expect(data.size).toBe(0);
  });

  it("rejects a stored profile with an unknown state or filing status", () => {
    data.set(STORAGE_KEYS.profile, JSON.stringify({ ...profile, state: "ZZ" }));
    expect(getProfile()).toBeNull();
    data.set(STORAGE_KEYS.profile, JSON.stringify({ ...profile, filingStatus: "married" }));
    expect(getProfile()).toBeNull();
    data.set(STORAGE_KEYS.profile, JSON.stringify(profile));
    expect(getProfile()).toEqual(profile);
  });

  it("reads back the in-memory copy when a write to storage fails", () => {
    setProfile(profile, { log: [] });
    const a = addLogEntry({ kind: "income", amount: 100, payer: "A", date: "2026-11-01", setAside: 20 });
    storageFull = true;
    const b = addLogEntry({ kind: "income", amount: 200, payer: "B", date: "2026-11-02", setAside: 40 });
    expect(JSON.parse(data.get(STORAGE_KEYS.log)!)).toHaveLength(1); // storage still holds the old log
    expect(getLog().map((e) => e.id)).toEqual([a.id, b.id]);
    storageFull = false;
    removeLogEntry(a.id);
    expect(getLog().map((e) => e.id)).toEqual([b.id]);
    expect(JSON.parse(data.get(STORAGE_KEYS.log)!)).toHaveLength(1);
  });

  it("refreshPro caches the server's answer", async () => {
    const answer = (pro: boolean) => vi.fn(async () => new Response(JSON.stringify({ pro }))) as unknown as typeof fetch;
    expect(await refreshPro({ fetch: answer(true) })).toBe(true);
    expect(isPro()).toBe(true);
    expect(await refreshPro({ fetch: answer(false) })).toBe(false);
    expect(isPro()).toBe(false);
  });
});
