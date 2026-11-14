// The "How we check our numbers" page content: the four personas from the README section "Verified against
// the IRS worksheet" (same figures; a unit test checks each one against README.md) and the engine's sources
// (the citations in lib/tax/constants/federal2026.ts and engine/CONSTANTS.md).

export const VERIFIED_AS_OF = "Nov 14, 2026";

export interface VerifiedPersona {
  id: "A" | "B" | "C" | "D";
  who: string;
  /** What the engine (estimate(), and annualized() for C) returns. Each line is "label: value". */
  engine: string[];
  /** The same figures worked through the 2026 Form 1040-ES worksheet by hand. */
  hand: string;
  /** What a popular free calculator asks for, for comparison. */
  calculator: string;
}

export const VERIFIED_PERSONAS: VerifiedPersona[] = [
  {
    id: "A",
    who: "Single, $60k freelance (1099) income, 2025 tax $8k",
    engine: [
      "Total tax: $12,037.20",
      "Required for the year: $8,000 (100% of 2025 tax)",
      "Due by Jan 15: $8,000 (Q1–Q3 past due)",
      "With $2k paid on each of Apr 15, Jun 15 and Sep 15: $2,000",
    ],
    hand: "$12,037.20; $8,000; $2,000 a quarter",
    calculator: "$2,708 a quarter ($10,833 a year). It has no prior-year input.",
  },
  {
    id: "B",
    who: "Married filing jointly, W-2 $85k with $7k withheld, spouse $25k 1099, 2025 tax $9k",
    engine: [
      "Total tax: $11,602.83",
      "Required for the year: $9,000",
      "Withholding counts as $1,750 a quarter",
      "Due by Jan 15: $2,000 (Q1–Q3 short $500 each)",
    ],
    hand: "$11,602.83; $9,000; line 14a $2,000, $500 a quarter",
    calculator: "$860 a quarter ($3,442 a year), based on 90% of this year's tax minus withholding.",
  },
  {
    id: "C",
    who: "Single rideshare driver, $45k 1099 ($30k of it Sep–Dec), 2025 tax $4k",
    engine: [
      "Total tax: $8,579.50",
      "Required for the year: $4,000",
      "Regular schedule: $1,000 a quarter, due by Jan 15 $4,000",
      "Annualized (Schedule AI): $801.90, $801.90, $801.90, $1,594.31",
    ],
    hand: "$8,579.50; $4,000; Schedule AI by hand: $801.90 three times, then $1,594.31",
    calculator: "$1,930 a quarter ($7,721.55 a year). It has no income-timing input.",
  },
  {
    id: "D",
    who: "Single, $220k 1099, 2025 tax $40k, 2025 AGI $180k",
    engine: ["Total tax: $57,783.35", "Required for the year: $44,000 (110% of 2025 tax)", "Due by Jan 15: $44,000"],
    hand: "$57,783.35; $44,000",
    calculator: "$13,001 a quarter ($52,004 a year), based on 90% of this year's tax.",
  },
];

export interface VerifiedSource {
  name: string;
  what: string;
  url: string;
}

export const VERIFIED_SOURCES: VerifiedSource[] = [
  {
    name: "2026 Form 1040-ES",
    what: "The safe-harbor rules (90% of this year, 100% or 110% of last year), the four due dates and the worksheet.",
    url: "https://www.irs.gov/pub/irs-pdf/f1040es.pdf",
  },
  {
    name: "IRS Rev. Proc. 2025-32",
    what: "The 2026 inflation adjustments: tax brackets, standard deductions and the QBI thresholds.",
    url: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
  },
  {
    name: "SSA contribution and benefit base",
    what: "The 2026 Social Security wage base for self-employment tax.",
    url: "https://www.ssa.gov/oact/cola/cbb.html",
  },
  {
    name: "2026 Form 2210, Schedule AI",
    what: "The annualized income method for income that arrives unevenly (from the IRS early-release draft; the final 2026 form is not out yet).",
    url: "https://www.irs.gov/pub/irs-dft/f2210--dft.pdf",
  },
  {
    name: "IRS quarterly underpayment rates",
    what: "The interest rates behind the penalty estimate (Rev. Rul. 2025-22, 2026-5, 2026-10 and 2026-15).",
    url: "https://www.irs.gov/payments/quarterly-interest-rates",
  },
];
