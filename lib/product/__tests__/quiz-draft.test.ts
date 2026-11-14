import { beforeEach, describe, expect, it } from "vitest";
import { draftFromProfile, emptyDraft } from "@/lib/product/quiz";
import { chooseDraft, clearDraft, loadDraft, QUIZ_DRAFT_KEY, saveDraft } from "@/lib/product/quizDraft";
import type { LogEntry, Profile } from "@/lib/product/types";

const session = new Map<string, string>();
const local = new Map<string, string>();
const storage = (m: Map<string, string>) => ({
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k),
});
Object.assign(globalThis, {
  window: { sessionStorage: storage(session), localStorage: storage(local), addEventListener() {}, removeEventListener() {} },
});

const profile: Profile = {
  filingStatus: "single", state: "TX", ytdIncome: 41000, expectedIncome: 70000, w2Wages: 0, w2Withholding: 0,
  priorYearTax: 9000, priorYearAgi: 60000, estimatedPaid: 0, createdAt: "2026-11-01T10:00:00.000Z", isExample: false,
};
const log: LogEntry[] = [
  { id: "a", kind: "income", amount: 1234, payer: "RealClient", date: "2026-11-05", setAside: 300, createdAt: "2026-11-05T10:00:00.000Z" },
];

describe("chooseDraft", () => {
  it("ignores a new-quiz draft when this browser has the person's own plan, and edits that plan instead", () => {
    const stale = { ...emptyDraft(), step: 3 as const };
    const d = chooseDraft(stale, profile, log);
    expect(d.editing).toBe(true);
    expect(d).toEqual(draftFromProfile(profile, log));
  });

  it("keeps an editing draft, and a new-quiz draft when there is no own plan (none, or the example)", () => {
    const editing = { ...draftFromProfile(profile, log), step: 2 as const };
    expect(chooseDraft(editing, profile, log)).toBe(editing);
    const fresh = { ...emptyDraft(), step: 2 as const };
    expect(chooseDraft(fresh, null, [])).toBe(fresh);
    expect(chooseDraft(fresh, { ...profile, isExample: true }, log)).toBe(fresh);
  });

  it("without a saved draft: the own plan to edit, else a blank quiz (the example is not prefilled)", () => {
    expect(chooseDraft(null, profile, log).editing).toBe(true);
    expect(chooseDraft(null, null, [])).toEqual(emptyDraft());
    expect(chooseDraft(null, { ...profile, isExample: true }, log)).toEqual(emptyDraft());
  });
});

describe("restore on /start, then Edit my answers", () => {
  beforeEach(() => {
    session.clear();
    local.clear();
  });

  it("opens the restored plan, not a blank quiz", async () => {
    const store = await import("@/lib/product/store");
    // 1. Empty browser on /start: the quiz mounts with a blank draft and saves it.
    const onScreen = chooseDraft(loadDraft(), store.getProfile(), store.getLog());
    expect(onScreen.editing).toBe(false);
    saveDraft(onScreen);
    expect(session.has(QUIZ_DRAFT_KEY)).toBe(true);
    // 2. The saved copy is restored; RestoreRedirect drops the draft and blocks the quiz still on screen.
    store.restorePlan({ profile, log, added: 1 });
    clearDraft({ block: true });
    saveDraft({ ...onScreen, step: 2 });
    expect(session.has(QUIZ_DRAFT_KEY)).toBe(false);
    // 3. Later, "Edit my answers": a new quiz mounts and prefills from the restored plan.
    const edit = chooseDraft(loadDraft(), store.getProfile(), store.getLog());
    expect(edit.editing).toBe(true);
    expect(edit).toEqual(draftFromProfile(profile, log));
    // The new quiz can save its draft again.
    saveDraft(edit);
    expect(session.has(QUIZ_DRAFT_KEY)).toBe(true);
  });

  it("still opens the restored plan if the blank draft survived (the second guard)", async () => {
    const store = await import("@/lib/product/store");
    saveDraft(emptyDraft());
    store.restorePlan({ profile, log, added: 1 });
    const edit = chooseDraft(loadDraft(), store.getProfile(), store.getLog());
    expect(edit.editing).toBe(true);
  });
});
