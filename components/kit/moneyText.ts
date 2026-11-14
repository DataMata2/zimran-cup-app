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

/**
 * Typed text that is a plain dollar amount: digits, thousands commas, at most one decimal point with up to
 * two cents, optional "$" and spaces. Anything else ("1e5", "12abc", "1.2.3", "-5") is not an amount.
 */
const AMOUNT_TEXT = /^\s*\$?\s*[\d,]*(\.\d{0,2})?\s*$/;

/**
 * What MoneyInput does with a keystroke: the text to show and the value to report.
 * A valid amount is reformatted ("60000.50" → "60,000.50", 60000.5). Anything else is kept exactly as typed
 * and reported as NaN, so the form can show an error and block Continue instead of silently reading
 * "1e5" as 15. With `allowCents` false the cents are still read (so "60000.50" never becomes 6,000,050)
 * and the value is rounded to whole dollars.
 */
export function readMoneyInput(raw: string, allowCents = true): { text: string; value: number | null } {
  if (!AMOUNT_TEXT.test(raw)) return { text: raw, value: Number.NaN };
  const text = formatMoneyText(raw, true);
  const value = parseMoneyText(text);
  return { text, value: value !== null && !allowCents ? Math.round(value) : value };
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
