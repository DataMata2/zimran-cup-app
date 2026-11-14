// Self-employment tax (Schedule SE) and Additional Medicare Tax (Form 8959).

import { ADDITIONAL_MEDICARE, SE, type FilingStatus } from "./constants/federal2026";

export interface SeTax {
  /** Schedule SE line 6: net profit × 92.35% (0 if below the $400 floor or a loss). */
  netEarnings: number;
  socialSecurity: number;
  medicare: number;
  /** socialSecurity + medicare (excludes Additional Medicare). */
  total: number;
  /** Schedule SE line 13: deductible half of SE tax. */
  deduction: number;
  /** The Social Security wage base was used up (by W-2 wages and/or SE earnings). */
  wageBaseReached: boolean;
}

/**
 * @param netProfit net Schedule C profit for the year
 * @param ssWagesOfFreelancer W-2 Social Security wages of the self-employed person (reduce the wage base)
 */
export function selfEmploymentTax(netProfit: number, ssWagesOfFreelancer: number): SeTax {
  const roomUnderBase = Math.max(0, SE.ssWageBase - ssWagesOfFreelancer);
  let netEarnings = Math.max(0, netProfit) * SE.netEarningsFactor;
  if (netEarnings < SE.minNetEarnings) netEarnings = 0;
  const socialSecurity = SE.ssRate * Math.min(netEarnings, roomUnderBase);
  const medicare = SE.medicareRate * netEarnings;
  const total = socialSecurity + medicare;
  return {
    netEarnings,
    socialSecurity,
    medicare,
    total,
    deduction: SE.deductibleShare * total,
    wageBaseReached: roomUnderBase === 0 || (netEarnings > 0 && netEarnings >= roomUnderBase),
  };
}

/**
 * Form 8959: 0.9% on Medicare wages above the threshold, plus 0.9% on SE earnings above the threshold
 * reduced (not below 0) by Medicare wages. For MFJ, wages and threshold are combined for both spouses.
 */
export function additionalMedicareTax(medicareWages: number, seNetEarnings: number, status: FilingStatus): number {
  const threshold = ADDITIONAL_MEDICARE.threshold[status];
  const onWages = Math.max(0, medicareWages - threshold);
  const onSe = Math.max(0, seNetEarnings - Math.max(0, threshold - medicareWages));
  return ADDITIONAL_MEDICARE.rate * (onWages + onSe);
}
