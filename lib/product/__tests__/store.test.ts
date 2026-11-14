import { beforeEach, describe, expect, it } from "vitest";
import {
  addLogEntry, getLog, getProfile, isPro, removeLogEntry, resetAll, setPro, setProfile, STORAGE_KEYS,
} from "@/lib/product/store";
import { EXAMPLE_ANSWERS } from "@/lib/product/example";

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

const profile = { ...EXAMPLE_ANSWERS, createdAt: "2026-11-14T00:00:00.000Z" };

describe("store", () => {
  beforeEach(() => resetAll());

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
});
