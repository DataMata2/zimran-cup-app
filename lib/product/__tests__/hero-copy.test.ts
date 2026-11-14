import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanHero } from "@/components/plan/PlanHero";
import { planFacts, unknownDollarAmounts } from "@/lib/product/ai-prompts";
import { buildExample } from "@/lib/product/example";
import { buildTaxInput } from "@/lib/product/input";
import { money, moneyPay } from "@/lib/product/format";
import { calendarFile, calendarNote } from "@/lib/product/calendar";
import {
  catchUpLine,
  installmentRow,
  latePaidPenalty,
  latePaidText,
  lumpAssumptionText,
  nextStepText,
  pastDue,
  payTarget,
} from "@/lib/product/payNow";
import type { LogEntry, Profile } from "@/lib/product/types";
import { estimate, estimateAccruedPenalty, type TaxResult } from "@/lib/tax";

const AS_OF = "2026-11-14";
const { profile: maya, entry } = buildExample(AS_OF, new Date("2026-11-14T10:00:00Z"));
const mayaLog: LogEntry[] = [{ ...entry, id: "e1", createdAt: "2026-11-03T12:00:00.000Z" }];
const irs = (id: string, amount: number): LogEntry => ({
  id,
  kind: "irs",
  amount,
  payer: "",
  date: AS_OF,
  setAside: 0,
  createdAt: `${AS_OF}T12:00:00.000Z`,
});

const plan = (profile: Profile, log: LogEntry[]) => estimate(buildTaxInput(profile, log, AS_OF));
const hero = (result: TaxResult, lumpPaid = 0) => renderToStaticMarkup(createElement(PlanHero, { result, lumpPaid }));
/** Facts plus the hero's own text: every dollar figure the screen or the model may cite. */
const factsJson = (result: TaxResult, log: LogEntry[], profile: Profile) => JSON.stringify(planFacts(result, log, profile));

/** A clean profile that paid Q1–Q3 on time (the quiz lump sum is dated on or before Apr 15). */
const onTime: Profile = {
  filingStatus: "single",
  state: "TX",
  ytdIncome: 30000,
  expectedIncome: 60000,
  w2Wages: 0,
  w2Withholding: 0,
  priorYearTax: 8000,
  priorYearAgi: 50000,
  estimatedPaid: 6000,
  createdAt: "2026-07-01T00:00:00.000Z",
  isExample: false,
};

describe("hero after a quarter was paid late (Maya pays the missed Q3)", () => {
  const log = [...mayaLog, irs("p1", 1850)];
  const result = plan(maya, log);
  const late = latePaidPenalty(result, estimateAccruedPenalty(result));

  it("finds the penalty that built up, about $21", () => {
    expect(late).not.toBeNull();
    expect(late!).toBeGreaterThan(20.5);
    expect(late!).toBeLessThan(22);
    expect(latePaidText(late!)).toBe(
      "Paid late earlier this year: about $21 in penalty has built up (estimate). The IRS bills it after you file; it stopped growing once each quarter was paid.",
    );
  });

  it("keeps the pay target but drops penalty-proof, on screen and in the facts", () => {
    const html = hero(result);
    expect(html).toContain("to keep the penalty from growing.");
    expect(html).toContain("about $21 in penalty has built up");
    expect(html).not.toMatch(/penalty-proof/i);
    expect(html).not.toContain("no underpayment penalty applies");

    const facts = planFacts(result, log, maya);
    expect(facts.headline.says).toBe("Pay $1,850 by Jan 15, 2027 to keep the penalty from growing.");
    expect(facts.headline).toMatchObject({ accruedPenalty: { amount: "$21" } });
    expect(JSON.stringify(facts.headline)).not.toMatch(/penalty-proof/i);
  });

  it("gives the model every dollar figure it may cite", () => {
    const json = factsJson(result, log, maya);
    expect(unknownDollarAmounts(latePaidText(late!), [json])).toEqual([]);
    expect(unknownDollarAmounts("Pay $1,850 by Jan 15, 2027; about $21 has built up.", [json])).toEqual([]);
  });
});

describe("hero once everything is paid after a late quarter (Maya pays $1,850, then $3,700)", () => {
  const log = [...mayaLog, irs("p1", 1850), irs("p2", 3700)];
  const result = plan(maya, log);

  it("says paid up, not penalty-proof, and shows the penalty", () => {
    const html = hero(result);
    expect(html).toContain("You’re paid up for 2026.");
    expect(html).toContain("so no more penalty builds up");
    expect(html).toContain("about $21 in penalty has built up");
    expect(html).not.toMatch(/penalty-proof/i);
    expect(html).not.toContain("no underpayment penalty applies");

    const facts = planFacts(result, log, maya);
    expect(facts.headline.says).toBe("You’re paid up for 2026. No more estimated payments are needed.");
    expect(facts.headline).toMatchObject({ accruedPenalty: { amount: "$21" } });
  });
});

describe("hero for a clean, on-time profile (no quiz lump, IRS payments logged on time)", () => {
  const onTimeLogged: Profile = { ...onTime, estimatedPaid: 0 };
  const paid = (id: string, date: string, amount: number): LogEntry => ({ ...irs(id, amount), date });
  const q1q3 = [paid("a", "2026-04-15", 2000), paid("b", "2026-06-15", 2000), paid("c", "2026-09-15", 2000)];

  it("still says penalty-proof with a pay target", () => {
    const result = plan(onTimeLogged, q1q3);
    expect(latePaidPenalty(result, estimateAccruedPenalty(result))).toBeNull();
    const html = hero(result, 0);
    expect(html).toContain("to stay penalty-proof.");
    expect(html).not.toContain("in penalty has built up");
    expect(html).not.toContain("went in by each deadline");
    const facts = planFacts(result, q1q3, onTimeLogged);
    expect(facts.headline.says).toMatch(/^Pay \$[\d,]+ by Jan 15, 2027 to stay penalty-proof\.$/);
    expect(facts.headline).not.toHaveProperty("accruedPenalty");
    expect(facts.headline).not.toHaveProperty("assumption");
  });

  it("still says penalty-proof once all is paid", () => {
    const all = [...q1q3, paid("d", "2026-11-14", 3000)];
    const result = plan(onTimeLogged, all);
    const html = hero(result, 0);
    expect(html).toContain("You’re penalty-proof for 2026.");
    expect(html).toContain("no underpayment penalty applies");
    expect(planFacts(result, all, onTimeLogged).headline.says).toBe("You’re penalty-proof for 2026. No more estimated payments are needed.");
  });
});

describe("PP-QA-03: a quiz lump with unknown dates never reads as penalty-proof", () => {
  const assumption = "Assumes the $8,000 you’d already paid went in by each deadline. If some was late, log it under “I paid the IRS” instead.";

  it("states the assumption with the amount", () => {
    expect(lumpAssumptionText(8000)).toBe(assumption);
  });

  it("all paid by the lump ($8,000): neutral headline, the assumption, no penalty-proof in the hero or the facts", () => {
    const lump = { ...onTime, estimatedPaid: 8000 };
    const result = plan(lump, []);
    const html = hero(result, 8000);
    expect(html).toContain("You’re paid up for 2026.");
    expect(html).toContain("went in by each deadline");
    expect(html).not.toMatch(/penalty-proof/i);
    expect(html).not.toContain("no underpayment penalty applies");
    const facts = planFacts(result, [], lump);
    expect(facts.headline.says).toBe("You’re paid up for 2026. No more estimated payments are needed.");
    expect(facts.headline).toMatchObject({ assumption });
    expect(JSON.stringify(facts)).not.toMatch(/penalty-proof/i);
  });

  it("pay target with a lump: \"Pay $X by <date>.\" and the assumption, in the hero and the facts", () => {
    const result = plan(onTime, []); // $6,000 lump, Q4 still due
    const html = hero(result, 6000);
    expect(html).not.toMatch(/penalty-proof/i);
    expect(html).toContain(lumpAssumptionText(6000));
    const facts = planFacts(result, [], onTime);
    expect(facts.headline.says).toMatch(/^Pay \$[\d,]+ by Jan 15, 2027\.$/);
    expect(facts.headline).toMatchObject({ assumption: lumpAssumptionText(6000) });
    expect(JSON.stringify(facts)).not.toMatch(/penalty-proof/i);
  });

  it("past due with a lump (Maya): the assumption replaces the generic on-time line", () => {
    const result = plan(maya, mayaLog);
    const html = hero(result, maya.estimatedPaid);
    expect(html).toContain("Assumes the $3,700 you’d already paid went in by each deadline.");
    expect(html).not.toMatch(/penalty-proof/i);
    expect(planFacts(result, mayaLog, maya).headline).toMatchObject({ assumption: lumpAssumptionText(3700) });
  });
});

describe("PP-QA-08 (ruling): amounts to pay show exact cents and add up across hero, deadlines, .ics and facts", () => {
  // The reviewer's case: single TX, $60k, 2025 tax $8,001, nothing paid. Each quarter is $2,000.25.
  const p: Profile = { ...onTime, ytdIncome: 50000, priorYearTax: 8001, estimatedPaid: 0 };
  const icsAmounts = (ics: string) =>
    // The payment events only (pay-now and each deadline); the April return event is a balance, not a payment.
    [...ics.matchAll(/^SUMMARY:(.*estimated tax.*)$/gm)].map((m) => Number(/\$(\d+\.\d{2})/.exec(m[1]!)![1]));
  const cents = (s: string) => Math.round(Number(s.replace(/[$,]/g, "")) * 100);

  it("Nov 14: missed rows sum to the hero's pay-now; pay-now + next = the .ics sum; the facts say the same", () => {
    const result = plan(p, []);
    const due = pastDue(result)!;
    const target = payTarget(result)!;
    expect(due.quarters).toEqual([1, 2, 3]);
    const html = hero(result);
    expect(html).toContain("$6,000.75</span> now.");
    expect(html).toContain("$2,000.25");

    const rows = result.installments.map((i) => installmentRow(result, i));
    expect(rows.map((r) => r.amountText)).toEqual(["$2,000.25", "$2,000.25", "$2,000.25", "$2,000.25"]);
    const missed = rows.filter((r) => r.note === "Missed, pay now").reduce((sum, r) => sum + cents(r.amountText), 0);
    expect(missed).toBe(cents(moneyPay(due.amount)));

    const ics = icsAmounts(calendarFile(result));
    const parts = cents(moneyPay(due.amount)) + cents(moneyPay(target.amount));
    expect(Math.round(ics.reduce((a, b) => a + b, 0) * 100)).toBe(parts);
    expect(parts).toBe(800100);
    expect(calendarNote(result)).toContain("($6,000.75)");

    const facts = planFacts(result, [], p);
    expect(facts.headline).toMatchObject({
      says: "Missed Q1–Q3 payments: pay $6,000.75 now.",
      payNowAmount: "$6,000.75",
      thenAlsoPay: { amount: "$2,000.25" },
    });
    expect(JSON.stringify(facts)).not.toContain("totalIncludingPastDue");
    expect(facts.nextDeadline).not.toHaveProperty("amountDue");
    expect(facts.installments.map((i) => i.deadlinesListShows)).toEqual(rows.map((r) => r.amountText));
    expect(nextStepText(result)).toBe("Q1–Q3 are still past due. Pay $6,000.75 now, then $2,000.25 by Jan 15, 2027.");
  });

  it("Apr 1: the pay target shows $2,000.25, not a rounded figure", () => {
    const result = estimate(buildTaxInput(p, [], "2026-04-01"));
    expect(payTarget(result)!.amount).toBeCloseTo(2000.25, 6);
    expect(hero(result)).toContain("$2,000.25");
    expect(planFacts(result, [], p).headline.says).toBe("Pay $2,000.25 by Apr 15, 2026 to stay penalty-proof.");
    expect(planFacts(result, [], p).nextDeadline).toMatchObject({ amountDue: "$2,000.25" });
  });

  it("whole-dollar amounts stay whole (Maya: $1,850)", () => {
    expect(hero(plan(maya, mayaLog))).toContain("$1,850</span> now.");
  });
});

describe("catch-up line", () => {
  it("at the engine's cap (Maya), says even 60% won't cover it instead of advising 60%", () => {
    const result = plan(maya, mayaLog);
    expect(result.setAside.catchUpRate).toBe(0.6);
    const line = catchUpLine(result);
    expect(line).toEqual({
      text: `Haven’t set anything aside from the ${money(result.income.net1099Ytd)} you’ve earned so far? Even 60% of what’s still to come won’t cover it, so plan for a balance with your April return.`,
      capped: true,
    });
    const html = hero(result);
    expect(html).not.toContain("Catching up?");
    expect(html).toContain("you’ve earned so far? Even 60%");
    expect(html).not.toContain("Behind on saving?");
    const facts = planFacts(result, mayaLog, maya);
    expect(facts.setAside.catchUpSays).toBe(line!.text);
    expect(facts.setAside.catchUpRateIfNothingSavedYet).toBeNull();
  });

  it("below the cap, keeps the catch-up rate", () => {
    const real = plan(maya, mayaLog);
    const result = { ...real, setAside: { ...real.setAside, rate: 0.2, catchUpRate: 0.35 } };
    const text = `Haven’t set anything aside from the ${money(real.income.net1099Ytd)} you’ve earned so far? Then set aside 35% of what’s still to come instead.`;
    expect(catchUpLine(result)).toEqual({ text, capped: false });
    expect(hero(result)).toContain(text);
    expect(planFacts(result, mayaLog, maya).setAside.catchUpSays).toBe(text);
    expect(planFacts(result, mayaLog, maya).setAside.catchUpRateIfNothingSavedYet).toBe("35%");
  });

  it("hides the line when it equals the rate", () => {
    const real = plan(maya, mayaLog);
    expect(catchUpLine({ ...real, setAside: { ...real.setAside, rate: 0.25, catchUpRate: 0.25 } })).toBeNull();
  });
});
