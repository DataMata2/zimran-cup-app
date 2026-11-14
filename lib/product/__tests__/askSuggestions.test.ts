import { describe, expect, it } from "vitest";
import { estimate, type TaxResult } from "@/lib/tax";
import { APRIL_OWED, askSuggestions, Q4_HIGHER } from "@/lib/product/askSuggestions";
import { buildExample } from "@/lib/product/example";
import { buildTaxInput } from "@/lib/product/input";

const AS_OF = "2026-11-14";

describe("Ask chips (A11)", () => {
  const { profile, entry } = buildExample(AS_OF, new Date("2026-11-14T12:00:00Z"));
  const real = estimate(buildTaxInput(profile, [{ ...entry, id: "x", createdAt: "2026-11-14T00:00:00Z" }], AS_OF));

  it("equal instalments: no Q4 chip, the April question instead", () => {
    const s = askSuggestions(real);
    expect(s).not.toContain(Q4_HIGHER);
    expect(s[0]).toBe(APRIL_OWED);
  });

  it("offers the Q4 chip only when Q4's required amount is higher", () => {
    const higher: TaxResult = {
      ...real,
      installments: real.installments.map((i) => (i.quarter === 4 ? { ...i, required: i.required + 500 } : i)),
    };
    expect(askSuggestions(higher)[0]).toBe(Q4_HIGHER);
  });
});
