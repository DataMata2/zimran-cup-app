import { describe, expect, it } from "vitest";
import {
  caretAfterSignificant, formatMoneyText, moneyTextFromValue, parseMoneyText, readMoneyInput, significantBefore,
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

describe("readMoneyInput (A2: quiz and log amounts)", () => {
  it("keeps the decimal point and cents", () => {
    expect(readMoneyInput("60000.50")).toEqual({ text: "60,000.50", value: 60000.5 });
    expect(readMoneyInput("8000.75")).toEqual({ text: "8,000.75", value: 8000.75 });
    expect(readMoneyInput("1,284.50")).toEqual({ text: "1,284.50", value: 1284.5 });
    expect(readMoneyInput("$52,000")).toEqual({ text: "52,000", value: 52000 });
    expect(readMoneyInput("12.")).toEqual({ text: "12.", value: 12 });
  });
  it("reads empty text as no answer", () => {
    expect(readMoneyInput("").value).toBeNull();
    expect(readMoneyInput(".")).toEqual({ text: "0.", value: 0 });
    expect(readMoneyInput(".")).toEqual({ text: "0.", value: 0 });
  });
  it("rounds to whole dollars only when cents are off, never drops the point", () => {
    expect(readMoneyInput("60000.50", false).value).toBe(60001);
    expect(readMoneyInput("60000.49", false).value).toBe(60000);
  });
  it("rejects exponents and garbage as NaN, keeping the text as typed", () => {
    for (const raw of ["1e5", "12abc", "1.2.3", "-5", "1.234", "five"]) {
      const r = readMoneyInput(raw);
      expect(r.text).toBe(raw);
      expect(Number.isNaN(r.value)).toBe(true);
    }
  });
});
