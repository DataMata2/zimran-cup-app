import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VERIFIED_PERSONAS } from "@/lib/product/verified";

/** The README section the /how-we-check table is copied from. */
function readmeSection(): string {
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
  const start = readme.indexOf("## Verified against the IRS worksheet");
  expect(start).toBeGreaterThanOrEqual(0);
  const end = readme.indexOf("\n## ", start + 1);
  return readme.slice(start, end < 0 ? undefined : end);
}

describe("VERIFIED_PERSONAS", () => {
  const section = readmeSection();
  const rows = section.split("\n").filter((l) => /^\| \*\*[A-D]\*\*/.test(l));

  it("has the README's four personas, in order", () => {
    expect(rows).toHaveLength(4);
    expect(VERIFIED_PERSONAS.map((p) => p.id)).toEqual(["A", "B", "C", "D"]);
  });

  it.each(VERIFIED_PERSONAS.map((p, i) => [p.id, p, i] as const))("persona %s uses only figures from its README row", (_, p, i) => {
    const row = rows[i]!;
    const text = [p.who, ...p.engine, p.hand, p.calculator].join(" ");
    const amounts = text.match(/\$\d[\d,]*(?:\.\d+)?k?/g) ?? [];
    expect(amounts.length).toBeGreaterThan(3);
    for (const a of amounts) expect(row, `${a} in persona ${p.id}`).toContain(a);
  });

  it("keeps the comparison column unnamed, as in the README", () => {
    expect(section).toContain("A popular free calculator");
  });
});
