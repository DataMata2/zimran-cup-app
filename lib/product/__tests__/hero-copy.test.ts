import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanHero } from "@/components/plan/PlanHero";
import { planFacts, unknownDollarAmounts } from "@/lib/product/ai-prompts";
import { buildExample } from "@/lib/product/example";
import { buildTaxInput } from "@/lib/product/input";
import { money } from "@/lib/product/format";
import { catchUpLine, latePaidPenalty, latePaidText } from "@/lib/product/payNow";
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
const hero = (result: TaxResult) => renderToStaticMarkup(createElement(PlanHero, { result }));
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

describe("hero for a clean, on-time profile", () => {
  it("still says penalty-proof with a pay target", () => {
    const result = plan(onTime, []);
    expect(latePaidPenalty(result, estimateAccruedPenalty(result))).toBeNull();
    const html = hero(result);
    expect(html).toContain("to stay");
    expect(html).toContain("penalty-proof.");
    expect(html).not.toContain("in penalty has built up");
    const facts = planFacts(result, [], onTime);
    expect(facts.headline.says).toMatch(/^Pay \$[\d,]+ by Jan 15, 2027 to stay penalty-proof\.$/);
    expect(facts.headline).not.toHaveProperty("accruedPenalty");
  });

  it("still says penalty-proof once all is paid", () => {
    const paidUp = { ...onTime, estimatedPaid: 9000 };
    const result = plan(paidUp, []);
    const html = hero(result);
    expect(html).toContain("You’re penalty-proof for 2026.");
    expect(html).toContain("no underpayment penalty applies");
    expect(planFacts(result, [], paidUp).headline.says).toBe("You’re penalty-proof for 2026. No more estimated payments are needed.");
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
