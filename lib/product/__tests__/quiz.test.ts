import { describe, expect, it } from "vitest";
import { EXAMPLE_ANSWERS } from "@/lib/product/example";
import {
  checkWithEngine,
  clampStep,
  draftFromProfile,
  draftToProfile,
  emptyDraft,
  firstIncompleteStep,
  isStepValid,
  monthsElapsed,
  paidSoFarLabel,
  paidSoFarNote,
  parseDraft,
  stepErrors,
  stepForEngineField,
  suggestExpectedIncome,
  type QuizDraft,
} from "@/lib/product/quiz";
import { money } from "@/lib/product/format";
import { buildTaxInput } from "@/lib/product/input";
import { pastDue } from "@/lib/product/payNow";
import { penaltyMeter } from "@/lib/product/meter";
import { buildCsv } from "@/lib/product/csv";
import { planFacts } from "@/lib/product/ai-prompts";
import type { LogEntry, Profile } from "@/lib/product/types";
import { estimate } from "@/lib/tax";

const complete: QuizDraft = {
  ...emptyDraft(),
  filingStatus: "single",
  state: "CA",
  ytdIncome: 52000,
  expectedIncome: 64000,
  hasW2: false,
  priorKnown: true,
  priorYearTax: 7400,
  priorYearAgi: 49000,
  estimatedPaid: 3700,
};

const NOW = new Date("2026-11-14T12:00:00.000Z");

describe("step validation", () => {
  it("an empty draft is incomplete from step 1", () => {
    const d = emptyDraft();
    expect(firstIncompleteStep(d)).toBe(1);
    expect(stepErrors(d, 1)._missing).toBeDefined();
  });

  it("a complete draft passes every step", () => {
    expect(firstIncompleteStep(complete)).toBeNull();
  });

  it("step 2 needs a known state", () => {
    expect(isStepValid({ ...complete, state: null }, 2)).toBe(false);
    expect(isStepValid({ ...complete, state: "ZZ" as never }, 2)).toBe(false);
  });

  it("step 3: both amounts, expected ≥ so far, expected > 0", () => {
    expect(stepErrors({ ...complete, expectedIncome: null }, 3)._missing).toBeDefined();
    expect(stepErrors({ ...complete, expectedIncome: 40000 }, 3).expectedIncome).toMatch(/less than/);
    expect(isStepValid({ ...complete, expectedIncome: 52000 }, 3)).toBe(true);
    expect(stepErrors({ ...complete, ytdIncome: 0, expectedIncome: 0 }, 3).expectedIncome).toBeDefined();
    expect(isStepValid({ ...complete, ytdIncome: 0, expectedIncome: 30000 }, 3)).toBe(true);
  });

  it("A2: an amount that isn't one (NaN from the input) gets a field error and blocks the step", () => {
    const e3 = stepErrors({ ...complete, expectedIncome: Number.NaN }, 3);
    expect(e3.expectedIncome).toMatch(/Enter an amount/);
    expect(isStepValid({ ...complete, ytdIncome: Number.NaN }, 3)).toBe(false);
    expect(stepErrors({ ...complete, priorYearTax: Number.NaN }, 5).priorYearTax).toMatch(/Enter an amount/);
    expect(isStepValid({ ...complete, priorKnown: false, priorYearTax: Number.NaN }, 5)).toBe(true);
    expect(stepErrors({ ...complete, estimatedPaid: Number.NaN }, 6).estimatedPaid).toMatch(/Enter an amount/);
  });

  it("A2: cents are kept through to the profile", () => {
    const p = draftToProfile({ ...complete, ytdIncome: 52000.5, expectedIncome: 60000.5, priorYearTax: 8000.75 }, NOW);
    expect(p?.expectedIncome).toBe(60000.5);
    expect(p?.priorYearTax).toBe(8000.75);
  });

  it("step 4 is optional; with a W-2 job both amounts are required and withholding ≤ wages", () => {
    expect(isStepValid({ ...complete, hasW2: false, w2Wages: null }, 4)).toBe(true);
    expect(stepErrors({ ...complete, hasW2: true }, 4)._missing).toBeDefined();
    expect(stepErrors({ ...complete, hasW2: true, w2Wages: 0, w2Withholding: 0 }, 4).w2Wages).toBeDefined();
    expect(stepErrors({ ...complete, hasW2: true, w2Wages: 1000, w2Withholding: 2000 }, 4).w2Withholding).toBeDefined();
    expect(isStepValid({ ...complete, hasW2: true, w2Wages: 40000, w2Withholding: 0 }, 4)).toBe(true);
  });

  it("step 5: both amounts, or I don't know", () => {
    expect(isStepValid({ ...complete, priorYearAgi: null }, 5)).toBe(false);
    expect(isStepValid({ ...complete, priorKnown: false, priorYearTax: null, priorYearAgi: null }, 5)).toBe(true);
    expect(isStepValid({ ...complete, priorYearTax: 0 }, 5)).toBe(true);
  });

  it("step 6: a total (0 is fine)", () => {
    expect(isStepValid({ ...complete, estimatedPaid: null }, 6)).toBe(false);
    expect(isStepValid({ ...complete, estimatedPaid: 0 }, 6)).toBe(true);
  });

  it("clampStep never lets you past the first unanswered step", () => {
    expect(clampStep(emptyDraft(), 5)).toBe(1);
    expect(clampStep({ ...complete, state: null }, 6)).toBe(2);
    expect(clampStep(complete, 9)).toBe(6);
    expect(clampStep(complete, 0)).toBe(1);
    expect(clampStep(complete, Number.NaN)).toBe(1);
  });
});

describe("draft → Profile", () => {
  it("maps a complete draft", () => {
    expect(draftToProfile(complete, NOW)).toEqual({
      filingStatus: "single",
      state: "CA",
      ytdIncome: 52000,
      expectedIncome: 64000,
      w2Wages: 0,
      w2Withholding: 0,
      priorYearTax: 7400,
      priorYearAgi: 49000,
      estimatedPaid: 3700,
      createdAt: NOW.toISOString(),
      isExample: false,
    });
  });

  it("returns null when incomplete", () => {
    expect(draftToProfile({ ...complete, estimatedPaid: null }, NOW)).toBeNull();
  });

  it("drops W-2 amounts when the toggle is off, and nulls prior year on I don't know", () => {
    const p = draftToProfile(
      { ...complete, hasW2: false, w2Wages: 50000, w2Withholding: 5000, priorKnown: false },
      NOW,
    );
    expect(p).toMatchObject({ w2Wages: 0, w2Withholding: 0, priorYearTax: null, priorYearAgi: null });
  });

  it("keeps W-2 amounts when the toggle is on", () => {
    const p = draftToProfile({ ...complete, filingStatus: "mfj", hasW2: true, w2Wages: 50000, w2Withholding: 5000 }, NOW);
    expect(p).toMatchObject({ filingStatus: "mfj", w2Wages: 50000, w2Withholding: 5000 });
  });

  it("round-trips through draftFromProfile (editing)", () => {
    const profile: Profile = { ...EXAMPLE_ANSWERS, isExample: false, createdAt: NOW.toISOString() };
    const d = draftFromProfile(profile);
    expect(d.editing).toBe(true);
    expect(d.step).toBe(1);
    expect(draftToProfile(d, NOW)).toEqual(profile);
  });

  it("draftFromProfile: unknown prior year and W-2 job", () => {
    const profile: Profile = {
      ...EXAMPLE_ANSWERS, isExample: false, createdAt: NOW.toISOString(),
      priorYearTax: null, priorYearAgi: null, w2Wages: 30000, w2Withholding: 2000,
    };
    const d = draftFromProfile(profile);
    expect(d).toMatchObject({ priorKnown: false, hasW2: true, w2Wages: 30000, w2Withholding: 2000 });
  });
});

describe("engine check", () => {
  it("accepts a valid profile", () => {
    const p = draftToProfile(complete, NOW)!;
    expect(checkWithEngine(p, [], "2026-11-14")).toBeNull();
  });

  it("maps a TaxInputError to the step that owns the field", () => {
    const p = { ...draftToProfile(complete, NOW)!, w2Wages: -1 };
    expect(checkWithEngine(p, [], "2026-11-14")?.step).toBe(4);
    const q = { ...draftToProfile(complete, NOW)!, state: "ZZ" as never };
    expect(checkWithEngine(q, [], "2026-11-14")?.step).toBe(2);
  });

  it("stepForEngineField handles nested fields and unknowns", () => {
    expect(stepForEngineField("estimatedPaymentsMade[2].date")).toBe(6);
    expect(stepForEngineField("priorYearAgi")).toBe(5);
    expect(stepForEngineField("asOf")).toBe(6);
  });
});

describe("income suggestion", () => {
  it("monthsElapsed is fractional by day, at least 1, 12 after the year", () => {
    expect(monthsElapsed("2026-01-01")).toBe(1);
    expect(monthsElapsed("2026-12-31")).toBeCloseTo(12, 5);
    expect(monthsElapsed("2026-07-02")).toBeCloseTo((183 / 365) * 12, 5);
    expect(monthsElapsed("2027-03-01")).toBe(12);
  });

  it("projects so far × 12 / months elapsed, rounded to $100", () => {
    // Nov 14 is day 318: 52,000 × 12 / (318/365×12) = 52,000 × 365/318 = 59,685 → 59,700.
    expect(suggestExpectedIncome(52000, "2026-11-14")).toBe(59700);
    expect(suggestExpectedIncome(10000, "2026-01-10")).toBe(120000);
  });

  it("is null with nothing to project and never below so far", () => {
    expect(suggestExpectedIncome(null, "2026-11-14")).toBeNull();
    expect(suggestExpectedIncome(0, "2026-11-14")).toBeNull();
    expect(suggestExpectedIncome(52040, "2027-02-01")).toBe(52040);
  });
});

describe("parseDraft", () => {
  it("rejects junk and keeps only valid fields", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("{")).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 2 }))).toBeNull();
    const d = parseDraft(JSON.stringify({ v: 1, step: 4, filingStatus: "qss", state: "CA", ytdIncome: -5 }));
    expect(d).toMatchObject({ filingStatus: null, state: "CA", ytdIncome: null, step: 1 });
  });

  it("restores a saved draft and clamps the step", () => {
    const saved = JSON.stringify({ ...complete, step: 6 });
    expect(parseDraft(saved)).toEqual({ ...complete, step: 6 });
    const partial = JSON.stringify({ ...complete, estimatedPaid: null, priorYearTax: null, step: 6 });
    expect(parseDraft(partial)?.step).toBe(5);
  });
});

describe("editing with logged income", () => {
  const profile: Profile = { ...EXAMPLE_ANSWERS, isExample: false, createdAt: NOW.toISOString() };
  const entry = (kind: "income" | "irs", amount: number) => ({
    id: `${kind}${amount}`, kind, amount, payer: "", date: "2026-11-03", setAside: 0, createdAt: NOW.toISOString(),
  });
  const log = [entry("income", 4200), entry("irs", 1000), entry("income", 800)];

  it("prefills Received so far with the true total (profile + logged income)", () => {
    const d = draftFromProfile(profile, log);
    expect(d).toMatchObject({ ytdIncome: 52000 + 5000, loggedIncome: 5000, loggedCount: 2 });
  });

  it("stores entered − logged on save, so the engine's total is the entered amount", () => {
    const d = { ...draftFromProfile(profile, log), ytdIncome: 60000, expectedIncome: 70000 };
    expect(draftToProfile(d, NOW)?.ytdIncome).toBe(55000);
    // Unchanged answers round-trip to the same profile.
    expect(draftToProfile(draftFromProfile(profile, log), NOW)).toEqual(profile);
  });

  it("uses the log as it stands at save time and never stores below 0", () => {
    const d = { ...draftFromProfile(profile, log), ytdIncome: 5000 };
    expect(draftToProfile(d, NOW, 5000)?.ytdIncome).toBe(0);
    expect(draftToProfile(d, NOW, 6000)?.ytdIncome).toBe(0);
    expect(draftToProfile(d, NOW, 0)?.ytdIncome).toBe(5000);
  });

  it("rejects an entered total below what's logged; expected is checked against the entered total", () => {
    const d = draftFromProfile(profile, log);
    expect(stepErrors({ ...d, ytdIncome: 4000 }, 3).ytdIncome).toBe(
      "That's less than the $5,000 you've already logged. Remove payments from your log, or enter at least $5,000.",
    );
    expect(isStepValid({ ...d, ytdIncome: 5000, expectedIncome: 5000 }, 3)).toBe(true);
    expect(stepErrors({ ...d, ytdIncome: 57000, expectedIncome: 56000 }, 3).expectedIncome).toBeDefined();
  });

  it("a fresh (non-editing) draft stores the entered amount as is", () => {
    expect(draftToProfile(complete, NOW, 5000)?.ytdIncome).toBe(52000);
  });

  it("parseDraft keeps logged income only for edits", () => {
    const d = draftFromProfile(profile, log);
    expect(parseDraft(JSON.stringify(d))).toMatchObject({ loggedIncome: 5000, loggedCount: 2 });
    expect(parseDraft(JSON.stringify({ ...complete, loggedIncome: 5000, loggedCount: 2 }))).toMatchObject({
      loggedIncome: 0, loggedCount: 0,
    });
  });
});

describe("LIVE-PP-01 / SHARED-01: the field is only what was paid before logging; the log is added once", () => {
  // qa-A repro: TX single, $60k, 2025 tax $8k (AGI $50k), paid $3,700 in the quiz, then log an IRS payment of $1,000.
  const ASOF = "2026-11-14";
  const profile: Profile = {
    filingStatus: "single", state: "TX", ytdIncome: 60000, expectedIncome: 60000, w2Wages: 0, w2Withholding: 0,
    priorYearTax: 8000, priorYearAgi: 50000, estimatedPaid: 3700, createdAt: NOW.toISOString(), isExample: false,
  };
  const irs: LogEntry = { id: "i1", kind: "irs", amount: 1000, payer: "", date: ASOF, setAside: 0, createdAt: NOW.toISOString() };
  const log = [irs];
  const payNowOf = (p: Profile) => pastDue(estimate(buildTaxInput(p, log, ASOF)))?.amount ?? 0;
  const totalPaid = (p: Profile, l: readonly LogEntry[] = log) =>
    (buildTaxInput(p, l, ASOF).estimatedPaymentsMade ?? []).reduce((s, x) => s + x.amount, 0);
  const saveWith = (v: number) => draftToProfile({ ...draftFromProfile(profile, log), estimatedPaid: v }, NOW)!;

  it("Edit shows 3,700 in the field and the sum line with all three numbers", () => {
    const d = draftFromProfile(profile, log);
    expect(d.estimatedPaid).toBe(3700);
    expect(d.loggedIrs).toBe(1000);
    expect(paidSoFarNote(d)).toBe("Before logging $3,700 + In your log $1,000 = Total paid $4,700");
  });

  it("the sum line follows the field as it is typed", () => {
    const d = { ...draftFromProfile(profile, log), estimatedPaid: 6000 };
    expect(paidSoFarNote(d)).toBe("Before logging $6,000 + In your log $1,000 = Total paid $7,000");
    expect(paidSoFarNote({ ...d, estimatedPaid: null })).toBe("Before logging $0 + In your log $1,000 = Total paid $1,000");
  });

  it("6,000 + log 1,000 → total 7,000 (stored as entered, no guessing)", () => {
    const saved = saveWith(6000);
    expect(saved.estimatedPaid).toBe(6000);
    expect(totalPaid(saved)).toBe(7000);
  });

  it("3,000 + log 1,000 → total 4,000", () => {
    const saved = saveWith(3000);
    expect(saved.estimatedPaid).toBe(3000);
    expect(totalPaid(saved)).toBe(4000);
  });

  it("4,700 (what used to trip the heuristic) is stored as 4,700: total 5,700", () => {
    expect(saveWith(4700).estimatedPaid).toBe(4700);
    expect(totalPaid(saveWith(4700))).toBe(5700);
    expect(paidSoFarNote({ ...draftFromProfile(profile, log), estimatedPaid: 4700 })).not.toMatch(/once|includes/);
  });

  it("open → save unchanged keeps the total, twice over, and the plan at Pay $1,300 now", () => {
    const once = draftToProfile(draftFromProfile(profile, log), NOW)!;
    const twice = draftToProfile(draftFromProfile(once, log), NOW)!;
    expect(once.estimatedPaid).toBe(3700);
    expect(twice.estimatedPaid).toBe(3700);
    expect(totalPaid(once)).toBe(4700);
    expect(totalPaid(twice)).toBe(4700);
    expect(money(payNowOf(profile))).toBe("$1,300");
    expect(money(payNowOf(once))).toBe("$1,300");
    expect(money(payNowOf(twice))).toBe("$1,300");
  });

  it("the hero meter, the CSV and the AI facts all agree on the total paid (6,000 + 1,000 = 7,000)", () => {
    const saved = saveWith(6000);
    const result = estimate(buildTaxInput(saved, log, ASOF));
    // Hero: the "Paid to the IRS" meter.
    const meter = penaltyMeter(result, log);
    expect(meter.paid).toBe(7000);
    // CSV: the Credited column of the instalment rows.
    const csv = buildCsv({ log, result, asOf: ASOF });
    const lines = csv.split("\r\n");
    const head = lines.findIndex((l) => l.startsWith("Quarter,Due,Required,Credited"));
    const credited = lines.slice(head + 1, head + 5).reduce((s, l) => s + Number(l.split(",")[3]), 0);
    expect(credited).toBe(7000);
    // planFacts (ai-prompts).
    const facts = planFacts(result, log, saved);
    expect(facts.paidToIrsMeter.estimatedTaxPaymentsFor2026).toBe("$7,000");
    expect(facts.paidToIrsMeter.paidIncludingWithholdingCreditedThroughNextDeadline).toBe("$7,000");
    expect(paidSoFarNote(draftFromProfile(saved, log))).toContain("Total paid $7,000");
  });

  it("the log is untouched by editing", () => {
    const before = JSON.stringify(log);
    draftToProfile({ ...draftFromProfile(profile, log), estimatedPaid: 6000 }, NOW);
    expect(JSON.stringify(log)).toBe(before);
  });

  it("the label says the field is only what was paid before the log", () => {
    expect(paidSoFarLabel(draftFromProfile(profile, log))).toBe("IRS payments made before you started logging here");
    expect(paidSoFarLabel(draftFromProfile(profile, []))).toBe("Paid so far for 2026");
    expect(paidSoFarLabel(complete)).toBe("Paid so far for 2026");
  });

  it("no sum line without logged IRS payments or outside edit mode", () => {
    expect(paidSoFarNote(draftFromProfile(profile, []))).toBeUndefined();
    expect(paidSoFarNote({ ...complete, loggedIrs: 1000 })).toBeUndefined();
  });

  it("parseDraft keeps loggedIrs only for edits, and still loads an old draft that carries lumpAtOpen", () => {
    expect(parseDraft(JSON.stringify(draftFromProfile(profile, log)))?.loggedIrs).toBe(1000);
    expect(parseDraft(JSON.stringify({ ...complete, loggedIrs: 1000 }))?.loggedIrs).toBe(0);
    const old = parseDraft(JSON.stringify({ ...draftFromProfile(profile, log), lumpAtOpen: 3700, estimatedPaid: 6000 }));
    expect(old).not.toBeNull();
    expect(old).not.toHaveProperty("lumpAtOpen");
    expect(draftToProfile(old!, NOW)!.estimatedPaid).toBe(6000);
  });
});

describe("engine messages", () => {
  it("are plain, with no internal field names", () => {
    const p = { ...draftToProfile(complete, NOW)!, w2Wages: -1 };
    const orig = console.error;
    console.error = () => {};
    try {
      const problem = checkWithEngine(p, [], "2026-11-14");
      expect(problem?.step).toBe(4);
      expect(problem?.message).not.toMatch(/w2Wages|finite/);
      expect(problem?.message).toMatch(/^Please check/);
    } finally {
      console.error = orig;
    }
  });
});
