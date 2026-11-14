// Federal income tax: brackets, standard deduction, simplified QBI deduction (IRC 199A).

import { BRACKETS, QBI, STANDARD_DEDUCTION, type Bracket, type FilingStatus } from "./constants/federal2026";

/** Tax on `taxable` under a progressive schedule (each rate applies to the slice inside its bracket). */
export function bracketTax(taxable: number, brackets: readonly Bracket[]): number {
  if (!(taxable > 0)) return 0;
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    const upper = b.upTo ?? Infinity;
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * b.rate;
    lower = upper;
  }
  return tax;
}

/**
 * Rate applied to the next dollar of taxable income. At an exact bracket top the next dollar falls in the
 * next bracket, so the boundary belongs to the upper rate.
 */
export function marginalRate(taxable: number, brackets: readonly Bracket[]): number {
  const t = Math.max(0, taxable);
  for (const b of brackets) {
    if (b.upTo === null || t < b.upTo) return b.rate;
  }
  const last = brackets[brackets.length - 1];
  return last ? last.rate : 0;
}

export function federalIncomeTax(taxable: number, status: FilingStatus): number {
  return bracketTax(taxable, BRACKETS[status]);
}

export function federalMarginalRate(taxable: number, status: FilingStatus): number {
  return marginalRate(taxable, BRACKETS[status]);
}

export function standardDeduction(status: FilingStatus): number {
  return STANDARD_DEDUCTION[status];
}

export type QbiZone = "below" | "phaseIn" | "above";

export interface QbiResult {
  deduction: number;
  zone: QbiZone;
}

/**
 * Simplified QBI deduction (IRC 199A), conservative.
 *  - qbi = net Schedule C profit − deductible half of SE tax (no SE health insurance / retirement modeled).
 *  - Below the threshold: rate × min(qbi, taxable income before QBI) (the 199A(a) income limit).
 *  - Inside the phase-in range, with p = (taxable − threshold) / range, the business is treated as a specified
 *    service trade or business (SSTB) that pays no W-2 wages and holds no property — the smallest deduction the
 *    rules allow:
 *      1. §199A(d)(3) applicable percentage: only (1 − p) of the SSTB's QBI counts (Form 8995-A Schedule A);
 *      2. the W-2 wage / UBIA limit is 0, so the phased-in reduction removes p of what is left
 *         (§199A(b)(3)(B); Form 8995-A Part III lines 17–26).
 *    Deduction = rate × QBI × (1 − p)², still capped at rate × taxable income. A non-SSTB would get
 *    rate × QBI × (1 − p), so this never overstates the deduction.
 *    Sources: https://www.irs.gov/instructions/i8995a, Treas. Reg. 1.199A-1(d)(2)(iv), 1.199A-5(a)(2).
 *  - At or above threshold + range: 0 (SSTB income is excluded entirely).
 *  - Not modeled: the OBBBA $400 minimum deduction (199A(i)), net capital gain in the income limit.
 */
export function qbiDeduction(qbi: number, taxableBeforeQbi: number, status: FilingStatus): QbiResult {
  const threshold = QBI.threshold[status];
  const range = QBI.phaseInRange[status];
  const over = taxableBeforeQbi - threshold;
  const zone: QbiZone = over <= 0 ? "below" : over < range ? "phaseIn" : "above";
  if (qbi <= 0 || taxableBeforeQbi <= 0) return { deduction: 0, zone };
  const kept = zone === "below" ? 1 : zone === "phaseIn" ? 1 - over / range : 0;
  const deduction = QBI.rate * Math.min(qbi * kept * kept, taxableBeforeQbi);
  return { deduction, zone };
}
