import { describe, expect, it } from "vitest";
import { estimate } from "@/lib/tax";
import { buildTaxInput } from "@/lib/product/input";
import { zeroStateTaxNote } from "@/lib/product/stateNote";
import type { Profile } from "@/lib/product/types";

const p: Profile = {
  filingStatus: "single", state: "OH", ytdIncome: 52000, expectedIncome: 60000, w2Wages: 0, w2Withholding: 0,
  priorYearTax: 8000, priorYearAgi: 50000, estimatedPaid: 0, createdAt: "2026-07-01T00:00:00.000Z", isExample: false,
};
const run = (x: Partial<Profile>) => estimate(buildTaxInput({ ...p, ...x }, [], "2026-11-14"));

describe("zero state tax note (A13)", () => {
  it("Ohio at $60k: $0 state tax explained by the business income deduction", () => {
    const r = run({});
    expect(r.tax.state).toBeLessThan(0.5);
    expect(zeroStateTaxNote(r, "OH")).toBe(
      "Ohio deducts the first $250,000 of business income, including freelance profit, so your Ohio income tax comes to $0.",
    );
  });
  it("no note for a state with no income tax, or one with tax due", () => {
    expect(zeroStateTaxNote(run({ state: "TX" }), "TX")).toBeNull();
    expect(zeroStateTaxNote(run({ state: "CA" }), "CA")).toBeNull();
  });
});
