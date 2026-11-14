import { describe, expect, it } from "vitest";
import { estimate } from "@/lib/tax";
import { buildTaxInput } from "@/lib/product/input";
import { planFacts } from "@/lib/product/ai-prompts";
import { money } from "@/lib/product/format";
import { safeHarborCopy } from "@/lib/product/safeHarborCopy";
import type { Profile } from "@/lib/product/types";

const AS_OF = "2026-11-14";
const base: Profile = {
  filingStatus: "single",
  state: "TX",
  ytdIncome: 52000,
  expectedIncome: 60000,
  w2Wages: 0,
  w2Withholding: 0,
  priorYearTax: 8000,
  priorYearAgi: 50000,
  estimatedPaid: 0,
  createdAt: "2026-07-01T00:00:00.000Z",
  isExample: false,
};
const run = (p: Partial<Profile>) => estimate(buildTaxInput({ ...base, ...p }, [], AS_OF));

describe("safe-harbor sentence (A3)", () => {
  it("100% of 2025: prints both options and the minimum", () => {
    const r = run({});
    expect(r.safeHarbor.rule).toBe("prior100");
    const c = safeHarborCopy(r);
    expect(c.says).toBe(
      `Paying 100% of your 2025 tax ($8,000) is less than 90% of your expected 2026 tax (${money(r.safeHarbor.currentYearOption)}), so $8,000 is your minimum for the year.`,
    );
  });

  it("110% of 2025 for a higher prior AGI, with the engine's reason", () => {
    const r = run({ priorYearAgi: 200000, priorYearTax: 8000 });
    expect(r.safeHarbor.rule).toBe("prior110");
    const c = safeHarborCopy(r);
    expect(c.says).toMatch(/^Paying 110% of your 2025 tax \(\$8,800, because your 2025 AGI was over \$[\d,]+\) is less than 90%/);
    expect(c.says).toContain("so $8,800 is your minimum");
  });

  it("90% of 2026 when it is lower than the prior-year option", () => {
    const r = run({ priorYearTax: 30000 });
    expect(r.safeHarbor.rule).toBe("current90");
    const ninety = money(r.safeHarbor.currentYearOption);
    expect(safeHarborCopy(r).says).toBe(
      `90% of your expected 2026 tax (${ninety}) is less than 100% of your 2025 tax ($30,000), so ${ninety} is your minimum for the year.`,
    );
  });

  it("prior year unknown: 90% only", () => {
    const r = run({ priorYearTax: null, priorYearAgi: null });
    const ninety = money(r.safeHarbor.currentYearOption);
    expect(safeHarborCopy(r).says).toBe(
      `Your minimum for the year is 90% of your expected 2026 tax: ${ninety}. Without your 2025 tax, the prior-year option isn't available.`,
    );
  });

  it("prior year $0: nothing required, and the 90% figure is still shown", () => {
    const r = run({ priorYearTax: 0 });
    expect(r.safeHarbor.rule).toBe("noneRequired");
    expect(safeHarborCopy(r).says).toContain(`90% of your expected 2026 tax is ${money(r.safeHarbor.currentYearOption)}`);
  });

  it("the AI facts carry the same sentence and figures", () => {
    const r = run({});
    const f = planFacts(r, []);
    expect(f.safeHarbor.says).toBe(safeHarborCopy(r).says);
    expect(f.safeHarbor.ninetyPercentOfExpected2026Tax).toBe(money(r.safeHarbor.currentYearOption));
    expect(f.safeHarbor.basedOn2025Tax).toBe("$8,000 (100% of your 2025 tax)");
  });
});
