// Pure helpers behind MoneyInput: turn whatever was typed into "12,345.67"-style text and back.

/** Longest whole-dollar part accepted (999,999,999). */
const MAX_INT_DIGITS = 9;

/**
 * Normalise typed text: keep digits and one decimal point (if `allowCents`, at most 2 decimals),
 * drop leading zeros, group thousands with commas. A trailing "." is kept so typing "12." works.
 */
export function formatMoneyText(raw: string, allowCents = true): string {
  let cleaned = raw.replace(allowCents ? /[^\d.]/g : /[^\d]/g, "");
  const dot = cleaned.indexOf(".");
  let intPart = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const decPart = dot === -1 ? null : cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  intPart = intPart.replace(/^0+(?=\d)/, "").slice(0, MAX_INT_DIGITS);
  if (intPart === "" && decPart !== null) intPart = "0";
  cleaned = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart !== null) cleaned += `.${decPart}`;
  return cleaned;
}

/** Parse formatted text to dollars; null when empty or just ".". */
export function parseMoneyText(text: string): number | null {
  const plain = text.replace(/,/g, "");
  if (plain === "" || plain === ".") return null;
  const n = Number(plain);
  return Number.isFinite(n) ? n : null;
}

/** Text for a stored value: 1234 → "1,234", 1234.5 → "1,234.50", null → "". */
export function moneyTextFromValue(value: number | null, allowCents = true): string {
  if (value === null || !Number.isFinite(value)) return "";
  const fixed = allowCents && !Number.isInteger(value) ? value.toFixed(2) : String(Math.round(value));
  return formatMoneyText(fixed, allowCents);
}

/** Count of digits and "." characters before `caret`, used to restore the caret after reformatting. */
export function significantBefore(text: string, caret: number): number {
  return text.slice(0, caret).replace(/[^\d.]/g, "").length;
}

/** Caret index in `text` after `count` digits / "." characters. */
export function caretAfterSignificant(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (/[\d.]/.test(text[i] ?? "")) seen++;
    if (seen === count) return i + 1;
  }
  return text.length;
}
