// Rounding helpers. The engine computes in unrounded dollars and rounds ONLY while building results.

function roundTo(x: number, decimals: number): number {
  const scale = 10 ** decimals;
  // Round half away from zero; the tiny nudge absorbs binary noise such as 1.005 -> 1.00499999.
  const r = (Math.sign(x) * Math.round(Math.abs(x) * scale * (1 + Number.EPSILON))) / scale;
  return r === 0 ? 0 : r; // never emit -0
}

/** Round a dollar amount to cents. */
export function round2(x: number): number {
  return roundTo(x, 2);
}

/** Round a rate (fraction 0..1) to 4 decimals. */
export function roundRate(x: number): number {
  return roundTo(x, 4);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function sum(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/** Format a rate as a percentage for messages: 0.009 -> "0.9%", 0.9 -> "90%". */
export function formatPct(rate: number): string {
  return `${Number((rate * 100).toFixed(4))}%`;
}
