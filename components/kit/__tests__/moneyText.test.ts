import { describe, expect, it } from "vitest";
import {
  caretAfterSignificant, formatMoneyText, moneyTextFromValue, parseMoneyText, significantBefore,
} from "@/components/kit/moneyText";

describe("money input text", () => {
  it("groups thousands and keeps up to two decimals", () => {
    expect(formatMoneyText("1234567")).toBe("1,234,567");
    expect(formatMoneyText("$1,234.567")).toBe("1,234.56");
    expect(formatMoneyText("12.")).toBe("12.");
    expect(formatMoneyText(".5")).toBe("0.5");
    expect(formatMoneyText("0007")).toBe("7");
    expect(formatMoneyText("1.2.3")).toBe("1.23");
    expect(formatMoneyText("abc")).toBe("");
    expect(formatMoneyText("12.5", false)).toBe("125");
    expect(formatMoneyText("12345678901")).toBe("123,456,789");
  });
  it("parses back to dollars", () => {
    expect(parseMoneyText("1,234.5")).toBe(1234.5);
    expect(parseMoneyText("")).toBeNull();
    expect(parseMoneyText(".")).toBeNull();
    expect(moneyTextFromValue(1234.5)).toBe("1,234.50");
    expect(moneyTextFromValue(52000)).toBe("52,000");
    expect(moneyTextFromValue(null)).toBe("");
  });
  it("keeps the caret after the same digit when commas move", () => {
    const raw = "12345"; // caret after "4"
    const next = formatMoneyText(raw);
    expect(next).toBe("12,345");
    expect(caretAfterSignificant(next, significantBefore(raw, 4))).toBe(5);
  });
});
