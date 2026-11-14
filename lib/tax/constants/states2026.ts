// State income tax constants, tax year 2026 (all 50 states + DC).
// verified: true only where the 2026 value was read at the state's own primary source on 2026-11-14.
// See ../../CONSTANTS.md for the full table and the UNVERIFIED list.
//
// Model (see PLAN.md): state tax = f(federal AGI) only. Not modeled anywhere: state credits, local/municipal/county
// income taxes, state-specific income modifications, dependents' exemptions, itemized deductions.

import type { Bracket, FilingStatus } from "./federal2026";

export type StateCode =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "DC" | "FL"
  | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME"
  | "MD" | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH"
  | "NJ" | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI"
  | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI"
  | "WY";

export type StateRule =
  | { kind: "none"; source: string }
  | {
      kind: "flat";
      rate: number;
      deduction: Record<FilingStatus, number>;
      base: "federalAgi" | "federalTaxable";
      source: string;
      note?: string;
      /**
       * Separate treatment of business income (Schedule C / SE income), e.g. Ohio's business income deduction:
       * the first `deduction` of business income is exempt, the rest is taxed at `excessRate`, and only the
       * nonbusiness part of the base goes through the flat schedule above.
       */
      businessIncome?: { deduction: Record<FilingStatus, number>; excessRate: number; source: string };
    }
  | { kind: "brackets"; brackets: Record<FilingStatus, Bracket[]>; deduction: Record<FilingStatus, number>; base: "federalAgi"; source: string; note?: string }
  | { kind: "approx"; effectiveRate: number; source: string; note: string };

type Entry = StateRule & { name: string; verified: boolean };

/** Same amount for every filing status. */
const all = (n: number): Record<FilingStatus, number> => ({ single: n, mfj: n, mfs: n, hoh: n, qss: n });

const APPROX_METHOD =
  "Effective rate = state tax / AGI for a single filer with $100,000 AGI (all wage/SE income), using the state's " +
  "standard deduction/exemption and bracket schedule (2025 schedule unless noted). Applied to federal AGI for all filing " +
  "statuses, so it overstates tax for joint filers with wider brackets and understates it at high incomes.";

// ---------------------------------------------------------------- California (brackets)
// Source: FTB, 2026 California Tax Rate Schedules, https://www.ftb.ca.gov/forms/2026/2026-540-tax-rate-schedules.pdf
// Schedule X = single & MFS; Schedule Y = MFJ & QSS; Schedule Z = HOH.
const CA_X: Bracket[] = [
  { upTo: 11456, rate: 0.01 },
  { upTo: 27157, rate: 0.02 },
  { upTo: 42861, rate: 0.04 },
  { upTo: 59498, rate: 0.06 },
  { upTo: 75197, rate: 0.08 },
  { upTo: 384109, rate: 0.093 },
  { upTo: 460927, rate: 0.103 },
  { upTo: 768213, rate: 0.113 },
  { upTo: null, rate: 0.123 },
];
const CA_Y: Bracket[] = [
  { upTo: 22912, rate: 0.01 },
  { upTo: 54314, rate: 0.02 },
  { upTo: 85722, rate: 0.04 },
  { upTo: 118996, rate: 0.06 },
  { upTo: 150394, rate: 0.08 },
  { upTo: 768218, rate: 0.093 },
  { upTo: 921854, rate: 0.103 },
  { upTo: 1536426, rate: 0.113 },
  { upTo: null, rate: 0.123 },
];
const CA_Z: Bracket[] = [
  { upTo: 22927, rate: 0.01 },
  { upTo: 54316, rate: 0.02 },
  { upTo: 70018, rate: 0.04 },
  { upTo: 86654, rate: 0.06 },
  { upTo: 102356, rate: 0.08 },
  { upTo: 522385, rate: 0.093 },
  { upTo: 626864, rate: 0.103 },
  { upTo: 1044771, rate: 0.113 },
  { upTo: null, rate: 0.123 },
];

// ---------------------------------------------------------------- New York State (brackets)
// Source: NYS DTF, Form IT-2105-I (2026), "New York State tax rates", p. 10,
// https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf (reflects 2026 rate cuts on the five lowest brackets).
const NY_SINGLE: Bracket[] = [
  { upTo: 8500, rate: 0.039 },
  { upTo: 11700, rate: 0.044 },
  { upTo: 13900, rate: 0.0515 },
  { upTo: 80650, rate: 0.054 },
  { upTo: 215400, rate: 0.059 },
  { upTo: 1077550, rate: 0.0685 },
  { upTo: 5000000, rate: 0.0965 },
  { upTo: 25000000, rate: 0.103 },
  { upTo: null, rate: 0.109 },
];
const NY_MFJ: Bracket[] = [
  { upTo: 17150, rate: 0.039 },
  { upTo: 23600, rate: 0.044 },
  { upTo: 27900, rate: 0.0515 },
  { upTo: 161550, rate: 0.054 },
  { upTo: 323200, rate: 0.059 },
  { upTo: 2155350, rate: 0.0685 },
  { upTo: 5000000, rate: 0.0965 },
  { upTo: 25000000, rate: 0.103 },
  { upTo: null, rate: 0.109 },
];
const NY_HOH: Bracket[] = [
  { upTo: 12800, rate: 0.039 },
  { upTo: 17650, rate: 0.044 },
  { upTo: 20900, rate: 0.0515 },
  { upTo: 107650, rate: 0.054 },
  { upTo: 269300, rate: 0.059 },
  { upTo: 1616450, rate: 0.0685 },
  { upTo: 5000000, rate: 0.0965 },
  { upTo: 25000000, rate: 0.103 },
  { upTo: null, rate: 0.109 },
];

export const STATES: Record<StateCode, Entry> = {
  // ================================================================ no broad income tax
  // Sources are the state revenue departments. Notes in comments (the "none" shape has no note field).
  AK: { name: "Alaska", kind: "none", verified: true, source: "https://tax.alaska.gov/" }, // no individual income tax
  FL: { name: "Florida", kind: "none", verified: true, source: "https://floridarevenue.com/taxes/taxesfees/Pages/default.aspx" },
  NV: { name: "Nevada", kind: "none", verified: true, source: "https://tax.nv.gov/" },
  // NH: interest & dividends tax repealed for tax periods beginning after 2024-12-31 (HB 2, 2023) -> nothing for 2026.
  NH: { name: "New Hampshire", kind: "none", verified: true, source: "https://www.revenue.nh.gov/taxes-glance/interest-dividends-tax" },
  SD: { name: "South Dakota", kind: "none", verified: true, source: "https://dor.sd.gov/" },
  // TN: Hall tax on interest/dividends fully repealed from 2021.
  TN: { name: "Tennessee", kind: "none", verified: true, source: "https://www.tn.gov/revenue/taxes/hall-income-tax.html" },
  TX: { name: "Texas", kind: "none", verified: true, source: "https://comptroller.texas.gov/taxes/" },
  // WA: no wage/SE income tax. 7% (9.9% above $1M) tax on long-term capital gains above an indexed exemption
  // (~$270k) exists but is out of scope for freelance income.
  WA: { name: "Washington", kind: "none", verified: true, source: "https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax" },
  WY: { name: "Wyoming", kind: "none", verified: true, source: "https://revenue.wyo.gov/" },

  // ================================================================ flat
  AZ: {
    name: "Arizona", kind: "flat", rate: 0.025, base: "federalAgi", verified: false,
    // Deduction VERIFIED: A.R.S. 43-1041, https://www.azleg.gov/ars/43/01041.htm (read 2026-11-14): subsection A
    // base amounts $15,750 single/MFS, $23,625 HOH, $31,500 MFJ (amended by HB 4168, 2026, to match OBBBA);
    // subsection H indexes them "in the same manner in which the federal basic standard deduction is adjusted"
    // (IRC 63) -> the 2026 federal amounts of Rev. Proc. 2025-32 ($16,100 / $24,150 / $32,200).
    // UNVERIFIED: the 2.5% flat rate (in force since TY2023) was not re-read at a primary page (azdor.gov returned 403).
    deduction: { single: 16100, mfj: 32200, mfs: 16100, hoh: 24150, qss: 32200 },
    source: "https://www.azleg.gov/ars/43/01041.htm",
    note: "2.5% flat on AZ taxable income (federal AGI minus AZ standard deduction, which A.R.S. 43-1041 indexes like the federal one). Dependent credits not modeled.",
  },
  CO: {
    name: "Colorado", kind: "flat", rate: 0.044, base: "federalTaxable", deduction: all(0), verified: false,
    // UNVERIFIED: 4.4% statutory rate (C.R.S. 39-22-104(1.7)). A TABOR-triggered temporary cut for TY2026 can only be
    // set after the FY2026-27 surplus is certified (2027). Colorado Legislative Council Staff forecasts (2026,
    // content.leg.colorado.gov, seen via search summary; PDFs did not render) expect the mechanism NOT to trigger
    // for TY2025-2027, so 4.4% stands. Not read at tax.colorado.gov (page has no rate text).
    source: "https://tax.colorado.gov/individual-income-tax",
    note: "4.4% of federal taxable income (CO starts from federal taxable income, so no extra deduction). QBI add-back for high-AGI filers and any TABOR temporary rate cut not modeled.",
  },
  GA: {
    name: "Georgia", kind: "flat", rate: 0.0499, base: "federalAgi", verified: true,
    // Source: GA DOR "Important Tax Updates" -> 2026 Income Tax Changes: flat 4.99%; standard deduction $15,000
    // single/HOH/MFS, $30,000 MFJ. QSS files with HOH status on Form 500 -> $15,000.
    deduction: { single: 15000, mfj: 30000, mfs: 15000, hoh: 15000, qss: 15000 },
    source: "https://dor.georgia.gov/important-tax-updates",
    note: "4.99% flat (HB 463, 2026, retroactive to 2026-01-01) on federal AGI minus GA standard deduction. $4,000-per-dependent exemption not modeled.",
  },
  ID: {
    name: "Idaho", kind: "flat", rate: 0.053, base: "federalAgi", verified: false,
    // UNVERIFIED (tax.idaho.gov refused connections 2026-11-14): 5.3% (HB 40, 2025; EY Tax News 2026-1829 says the
    // 2026 rate is unchanged). The 0% band is NOT $2,500/$5,000 (the 2023 figure): it is indexed, $4,811 single/MFS
    // and $9,622 MFJ/HOH/QSS for TY2025 (Idaho Form 40 schedule, via search summary). The 2026 indexed band is not
    // published yet; the 2025 band is used (slightly overstates tax). Std deduction = 2026 federal amounts (Idaho
    // conformed to OBBBA in 2026; ISTC 2026 withholding uses $16,100 / $32,200). deduction = std + 0% band.
    deduction: { single: 20911, mfj: 41822, mfs: 20911, hoh: 33772, qss: 41822 },
    source: "https://tax.idaho.gov/taxes/income-tax/individual-income/",
    note: "5.3% flat above a 0% band ($4,811 single/MFS, $9,622 joint/HOH/QSS — 2025 amounts; 2026 indexed band not yet published); deduction = 2026 federal standard deduction + 0% band. Grocery credit not modeled.",
  },
  IL: {
    name: "Illinois", kind: "flat", rate: 0.0495, base: "federalAgi", verified: true,
    // Source: IL DOR IL-700-T (2026), effective 2026-01-01: rate "4.95%", Line 1 exemption allowance "$2,925"
    // (read 2026-11-14). Rate also at https://tax.illinois.gov/research/taxrates/income.html ("4.95 percent").
    deduction: { single: 2925, mfj: 5850, mfs: 2925, hoh: 2925, qss: 2925 },
    source: "https://tax.illinois.gov/forms/withholding/currentyear/il-700-t-withholding-guide-tables.html",
    note: "4.95% flat on federal AGI minus $2,925 personal exemption per taxpayer (dependents not modeled). Exemption is disallowed if AGI > $250,000 ($500,000 MFJ) — not modeled.",
  },
  IN: {
    name: "Indiana", kind: "flat", rate: 0.0295, base: "federalAgi", verified: true,
    // Source: IN DOR rates page: "The Indiana Individual adjusted gross income tax rate for 2026 is 2.95%".
    // Exemption $1,000 per taxpayer (IC 6-3-1-3.5(a)(1)).
    deduction: { single: 1000, mfj: 2000, mfs: 1000, hoh: 1000, qss: 1000 },
    source: "https://www.in.gov/dor/resources/tax-rates-and-reports/rates-fees-and-penalties/",
    note: "2.95% flat on federal AGI minus $1,000 personal exemption(s). County income tax (roughly 0.5%-3.4%, paid by nearly all residents) NOT included.",
  },
  IA: {
    name: "Iowa", kind: "flat", rate: 0.038, base: "federalTaxable", deduction: all(0), verified: true,
    // Source: IDR press release 2025-10-21, "IDR Announces 2026 Individual Income Tax and Interest Rates": "a flat
    // tax rate of 3.8 percent" for all levels of taxable income (read 2026-11-14).
    source: "https://revenue.iowa.gov/press-release/2025-10-21/idr-announces-2026-individual-income-tax-and-interest-rates",
    note: "3.8% of taxable income; Iowa starts from federal taxable income, so no extra deduction. $40 personal credits not modeled.",
  },
  KY: {
    name: "Kentucky", kind: "flat", rate: 0.035, base: "federalAgi", verified: true,
    // Source: KY DOR 2026 Withholding Formula: "2026 Kentucky Standard Deduction: $3,360; 2026 Kentucky Tax Rate: 3.5%".
    // MFJ uses one $3,360 deduction (conservative; spouses filing separately on a combined return each get one).
    deduction: all(3360),
    source: "https://revenue.ky.gov/Forms/2026%20Withholding%20Formula.pdf",
    note: "3.5% flat (HB 1, 2025) on federal AGI minus $3,360 standard deduction. Local occupational license taxes NOT included.",
  },
  LA: {
    name: "Louisiana", kind: "flat", rate: 0.03, base: "federalAgi", verified: true,
    // Rate verified at LDR FAQ (flat 3% from 2025). Standard deduction: LDR Revenue Information Bulletin 26-019
    // (2026-09-28), https://dam.ldr.la.gov/lawspolicies/RIB%2026-019.pdf : 2026 amounts (2025 x 2.7% CPI-U)
    // $12,838 single/MFS, $25,676 MFJ/HOH/QSS (read 2026-11-14). (RIB 26-005's $12,875/$25,750 was a withholding-only estimate.)
    deduction: { single: 12838, mfj: 25676, mfs: 12838, hoh: 25676, qss: 25676 },
    source: "https://revenue.louisiana.gov/tax-education-and-faqs/faqs/income-tax-reform/what-are-the-individual-income-tax-rates-and-brackets/",
    note: "3% flat (Act 11, 2024 3rd Ex. Sess.) on federal AGI minus the 2026 CPI-indexed LA standard deduction (RIB 26-019).",
  },
  MA: {
    name: "Massachusetts", kind: "flat", rate: 0.05, base: "federalAgi", verified: false,
    // UNVERIFIED: personal exemptions $4,400 single/MFS, $8,800 MFJ, $6,800 HOH (M.G.L. c.62 s.3(B)(b)); 2026 surtax
    // threshold $1,107,750 (up from $1,083,150 for 2025). Both seen only in search summaries of mass.gov pages
    // (tax-rates page, personal-exemptions page, draft 2026 Form 1); mass.gov and malegislature.gov returned
    // 403/refused to the fetcher on 2026-11-14. Amounts unchanged since 2023 for exemptions; consistent across sources.
    deduction: { single: 4400, mfj: 8800, mfs: 4400, hoh: 6800, qss: 4400 },
    source: "https://www.mass.gov/info-details/massachusetts-tax-rates",
    note: "5% on Part B (wage/business) income = federal AGI minus personal exemption. NOT modeled: 4% surtax on taxable income over $1,107,750 (2026), and the 8.5% rate on short-term gains.",
  },
  MI: {
    name: "Michigan", kind: "flat", rate: 0.0425, base: "federalAgi", verified: false,
    // Rate: MI Treasury notice "4.25 income tax rate for individuals and fiduciaries in 2026 tax year".
    // UNVERIFIED: 2026 personal exemption $5,900 per person (up from $5,800 in 2025). Seen via search summary of the
    // primary Form 446 "2026 Michigan Income Tax Withholding Guide" (Rev. 02-26),
    // https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/SUW/TY2026/446_Withholding-Guide_2026.pdf
    // — michigan.gov returned 403 to the fetcher, so not opened.
    deduction: { single: 5900, mfj: 11800, mfs: 5900, hoh: 5900, qss: 5900 },
    source: "https://www.michigan.gov/treasury/reference/taxpayer-notices/2026/04/15/425-income-tax-rate-for-individuals-and-fiduciaries-in-2026-tax-year",
    note: "4.25% flat on federal AGI minus $5,900 personal exemption(s). City income taxes (Detroit 2.4% etc.) NOT included.",
  },
  MS: {
    name: "Mississippi", kind: "flat", rate: 0.04, base: "federalAgi", verified: true,
    // Source: MS DOR general-information page (read 2026-11-14): "Excess of $10,000 of Taxable Income is taxed @ 4%"
    // (TY2026); standard deduction $2,300 single/MFS, $4,600 MFJ, $3,400 head of family; exemption $6,000
    // single/MFS, $12,000 MFJ, $8,000 head of family. deduction = std + exemption + $10,000 0% band.
    deduction: { single: 18300, mfj: 26600, mfs: 18300, hoh: 21400, qss: 18300 },
    source: "https://www.dor.ms.gov/general-information",
    note: "4% on taxable income above $10,000 (0% band folded into deduction, applied once per return). MS has no QSS status: single amounts used.",
  },
  NC: {
    name: "North Carolina", kind: "flat", rate: 0.0399, base: "federalAgi", verified: true,
    // Sources (read 2026-11-14): NCDOR tax-rate-schedules page: "For Taxable Years after 2025, the North Carolina
    // individual income tax rate is 3.99%". NCDOR NC-30 (2026 withholding): "tax year 2026 will be 3.99%", annual
    // standard deduction $12,750 single and $19,125 HOH. NCDOR standard-deduction page: $25,500 MFJ/QSS, $12,750 MFS.
    // S 437 (2025, would raise to $13,000/$26,000/$19,500) was not enacted; NCDOR's notice on S.L. 2026-31/2026-41
    // lists no standard-deduction or rate change.
    deduction: { single: 12750, mfj: 25500, mfs: 12750, hoh: 19125, qss: 25500 },
    source: "https://www.ncdor.gov/taxes-forms/individual-income-tax/tax-rate-schedules",
    note: "3.99% flat on federal AGI minus NC standard deduction. Child deduction not modeled.",
  },
  OH: {
    name: "Ohio", kind: "flat", rate: 0.0275, base: "federalAgi", verified: false,
    // UNVERIFIED: HB 96 (2025) schedule for 2026: $0 on income <= $26,050; above that $332 + 2.75% of the excess.
    // Seen in search summaries of R.C. 5747.02 (codes.ohio.gov) and the LSC HB 96 Greenbook; those hosts and
    // tax.ohio.gov refused/404'd the fetcher. Caveat: the 2025 IT 1040 booklet (dam.assets.ohio.gov, opened) shows
    // a $342 base for 2025, and the Jan-2025 2026 IT 1040ES worksheet still shows the pre-HB 96 schedule
    // ($342 + 2.75%, 3.125% over $100k) — so the $332 base is not confirmed at a page that was opened.
    // Business income deduction, MODELED via `businessIncome` below: R.C. 5747.01(A)(31) deducts the first
    // $250,000 ($125,000 MFS) of business income (Schedule C/SE income counts); R.C. 5747.02(A)(4) taxes business
    // income above that at a flat 3%. UNVERIFIED: codes.ohio.gov refused the fetcher; amounts are statutory (not
    // indexed) and match the 2025 IT 1040 booklet's Schedule IT BUS.
    // Exemption ($1,900 at MAGI > $80k; none above $500k MAGI in 2026) also ignored.
    // Folded into a flat rule: 2.75% x (AGI - 13,977) where 13,977 = 26,050 - 332/0.0275. Exact above $26,050;
    // overstates tax between ~$13,977 and $26,050. Personal exemptions ($1,900-$2,400) ignored (conservative).
    deduction: all(13977),
    source: "https://tax.ohio.gov/individual/resources/annual-tax-rates",
    businessIncome: {
      deduction: { single: 250000, mfj: 250000, mfs: 125000, hoh: 250000, qss: 250000 },
      excessRate: 0.03,
      source: "https://codes.ohio.gov/ohio-revised-code/section-5747.01 (A)(31); https://codes.ohio.gov/ohio-revised-code/section-5747.02 (A)(4)",
    },
    note: "2.75% flat above $26,050 (HB 96) as an equivalent deduction of $13,977, applied to nonbusiness income. Business income (incl. self-employment): first $250,000 ($125,000 MFS) deducted, the rest taxed at a flat 3%. Municipal income taxes (often 2%-2.5%) and school district income taxes NOT included.",
  },
  PA: {
    name: "Pennsylvania", kind: "flat", rate: 0.0307, base: "federalAgi", deduction: all(0), verified: true,
    // Source: PA DOR: "levied at the rate of 3.07 percent against taxable income".
    source: "https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx",
    note: "3.07% flat, no standard deduction or exemption. PA actually taxes eight classes of income (net profits computed under PA rules); federal AGI used as proxy. Local earned income tax (typically 1%-3.8%) NOT included.",
  },
  UT: {
    name: "Utah", kind: "flat", rate: 0.0445, base: "federalAgi", deduction: all(0), verified: false,
    // UNVERIFIED: 4.45% for 2026 per SB 60 (2026, retroactive to 2026-01-01),
    // https://le.utah.gov/Session/2026/bills/enrolled/SB0060.pdf and Utah Code 59-10-104 (version effective
    // 1/1/2026). Seen via search summaries (le.utah.gov listing + EY Tax News 2026-0913, Pub 14 revised 4/14/2026);
    // le.utah.gov refused and tax.utah.gov returned 403 to the fetcher.
    source: "https://tax.utah.gov/",
    note: "4.45% flat on federal AGI. Utah has no standard deduction; its taxpayer tax credit (6% of federal std deduction) phases out for mid/high incomes and is not modeled (conservative).",
  },

  // ================================================================ full brackets
  CA: {
    name: "California", kind: "brackets", base: "federalAgi", verified: true,
    brackets: { single: CA_X, mfs: CA_X, mfj: CA_Y, qss: CA_Y, hoh: CA_Z },
    // Source: FTB Tax News, October 2026 (2026 indexed amounts): standard deduction $5,900 single/MFS,
    // $11,800 MFJ/QSS/HOH. https://www.ftb.ca.gov/about-ftb/newsroom/tax-news/2026/10.html
    deduction: { single: 5900, mfj: 11800, mfs: 5900, hoh: 11800, qss: 11800 },
    source: "https://www.ftb.ca.gov/forms/2026/2026-540-tax-rate-schedules.pdf",
    note: "2026 FTB rate schedules on federal AGI minus CA standard deduction. NOT modeled: personal exemption CREDIT ($158 single/MFS/HOH, $316 MFJ/QSS, $491 per dependent; 2026) — a credit, left out (overstates tax by that amount); 1% Mental Health Services Tax on taxable income over $1M; CA SDI (wage withholding, not SE).",
  },
  NY: {
    name: "New York", kind: "brackets", base: "federalAgi", verified: true,
    brackets: { single: NY_SINGLE, mfs: NY_SINGLE, mfj: NY_MFJ, qss: NY_MFJ, hoh: NY_HOH },
    // Source: IT-2105-I (2026) standard deduction table: single $8,000, MFJ $16,050, MFS $8,000, HOH $11,200, QSS $16,050.
    deduction: { single: 8000, mfj: 16050, mfs: 8000, hoh: 11200, qss: 16050 },
    source: "https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf",
    note: "New York STATE tax only, on federal AGI (≈ NYAGI) minus NY standard deduction. NOT included: New York City and Yonkers resident taxes, MCTMT on self-employment earnings in the MCTD, and the tax-benefit recapture (supplemental tax) that applies when NYAGI exceeds $107,650.",
  },

  // ================================================================ approximate effective rate
  // All approx entries: verified false; method = APPROX_METHOD; source = the state revenue department.
  AL: {
    name: "Alabama", kind: "approx", effectiveRate: 0.041, verified: false,
    source: "https://www.revenue.alabama.gov/individual-corporate/individual-income-tax/",
    note: `${APPROX_METHOD} AL: 2%/4%/5% (top 5% over $3,000), $2,500 std deduction, $1,500 exemption, and AL allows a deduction for federal income tax paid (~$13k at this income). Local occupational taxes not included.`,
  },
  AR: {
    name: "Arkansas", kind: "approx", effectiveRate: 0.036, verified: false,
    source: "https://www.dfa.arkansas.gov/office/taxes/income-tax-administration/",
    note: `${APPROX_METHOD} AR: top rate 3.9%, ~$2,400 std deduction, high-income bracket adjustment.`,
  },
  CT: {
    name: "Connecticut", kind: "approx", effectiveRate: 0.049, verified: false,
    source: "https://portal.ct.gov/drs",
    note: `${APPROX_METHOD} CT: 2% / 4.5% / 5.5% (to $100k single), personal exemption fully phased out at this AGI, plus 2%-bracket benefit recapture.`,
  },
  DE: {
    name: "Delaware", kind: "approx", effectiveRate: 0.053, verified: false,
    source: "https://revenue.delaware.gov/",
    note: `${APPROX_METHOD} DE: 0%-6.6% (6.6% over $60k), $3,250 std deduction, $110 personal credit. Wilmington city wage tax not included.`,
  },
  DC: {
    name: "District of Columbia", kind: "approx", effectiveRate: 0.055, verified: false,
    source: "https://otr.cfo.dc.gov/page/dc-individual-and-fiduciary-income-tax-rates",
    note: `${APPROX_METHOD} DC: 4% / 6% / 6.5% / 8.5% (to $250k), standard deduction ≈ federal. DC also has an unincorporated business franchise tax (9.75% on unincorporated businesses > $12,000 gross) — not included.`,
  },
  HI: {
    name: "Hawaii", kind: "approx", effectiveRate: 0.058, verified: false,
    source: "https://tax.hawaii.gov/",
    note: `${APPROX_METHOD} HI: 1.4%-11% with brackets widened from 2025 by Act 46 (2024), ~$8,000 std deduction (2026 step), $1,144 exemption.`,
  },
  KS: {
    name: "Kansas", kind: "approx", effectiveRate: 0.048, verified: false,
    source: "https://www.ksrevenue.gov/",
    note: `${APPROX_METHOD} KS: 5.2% to $23,000, 5.58% above (single, from 2024), $3,605 std deduction, $9,160 exemption.`,
  },
  ME: {
    name: "Maine", kind: "approx", effectiveRate: 0.052, verified: false,
    source: "https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax",
    note: `${APPROX_METHOD} ME: 5.8% / 6.75% / 7.15% (indexed), standard deduction ≈ federal, ~$5,150 exemption.`,
  },
  MD: {
    name: "Maryland", kind: "approx", effectiveRate: 0.044, verified: false,
    source: "https://www.marylandtaxes.gov/individual/income/tax-info/tax-rates.php",
    note: `${APPROX_METHOD} MD: state 2%-4.75% (to $100k single; 2025 law added 6.25%/6.5% above $500k/$1M), $3,350 flat std deduction, partial exemption. MANDATORY COUNTY TAX (2.25%-3.3% of MD taxable income, every resident) NOT included — add ~3% for a realistic total.`,
  },
  MN: {
    name: "Minnesota", kind: "approx", effectiveRate: 0.053, verified: false,
    source: "https://www.revenue.state.mn.us/minnesota-income-tax-rates-and-brackets",
    note: `${APPROX_METHOD} MN: 5.35% / 6.8% / 7.85% / 9.85% (indexed), ~$15,000 std deduction.`,
  },
  MO: {
    name: "Missouri", kind: "approx", effectiveRate: 0.038, verified: false,
    source: "https://dor.mo.gov/taxation/individual/tax-types/income/",
    note: `${APPROX_METHOD} MO: graduated to 4.7% top (reached at ~$9k), std deduction = federal. Kansas City/St. Louis 1% earnings taxes not included.`,
  },
  MT: {
    name: "Montana", kind: "approx", effectiveRate: 0.043, verified: false,
    source: "https://revenue.mt.gov/",
    note: `${APPROX_METHOD} MT: two brackets (4.7% / ~5.65% top for 2026 under HB 337, 2025) on federal taxable income (MT starts from federal taxable income since 2024).`,
  },
  NE: {
    name: "Nebraska", kind: "approx", effectiveRate: 0.037, verified: false,
    source: "https://revenue.nebraska.gov/",
    note: `${APPROX_METHOD} NE: 2.46% / 3.51% / top 4.55% for 2026 (LB 754, 2023), ~$8,600 std deduction, ~$171 personal credit.`,
  },
  NJ: {
    name: "New Jersey", kind: "approx", effectiveRate: 0.042, verified: false,
    source: "https://www.nj.gov/treasury/taxation/taxtables.shtml",
    // Spot-check 2026-11-14: NJ Treasury tax-tables page lists one "2020 and After" schedule (no 2026 change found).
    // Recomputed: $99,000 taxable -> $4,180 = 4.18% of $100k -> 0.042 holds. Brackets themselves not re-read (PDF).
    note: `${APPROX_METHOD} NJ: 1.4% / 1.75% / 3.5% / 5.525% / 6.37% (to $500k single), $1,000 exemption, no standard deduction. NJ gross income differs from federal AGI (no SE-tax deduction).`,
  },
  NM: {
    name: "New Mexico", kind: "approx", effectiveRate: 0.036, verified: false,
    source: "https://www.tax.newmexico.gov/individuals/personal-income-tax-information-overview/",
    note: `${APPROX_METHOD} NM: 1.5%-5.9% (brackets restructured from 2025 by HB 252, 2024), standard deduction = federal.`,
  },
  ND: {
    name: "North Dakota", kind: "approx", effectiveRate: 0.007, verified: false,
    source: "https://www.tax.nd.gov/",
    note: `${APPROX_METHOD} ND: 0% to ~$48,475, 1.95% to ~$244,825, 2.5% above (single, indexed), on federal taxable income.`,
  },
  OK: {
    name: "Oklahoma", kind: "approx", effectiveRate: 0.04, verified: false,
    source: "https://oklahoma.gov/tax.html",
    note: `${APPROX_METHOD} OK: graduated to a 4.5% top rate for 2026 (HB 2764, 2025), $6,350 std deduction, $1,000 exemption.`,
  },
  OR: {
    name: "Oregon", kind: "approx", effectiveRate: 0.072, verified: false,
    source: "https://www.oregon.gov/dor/programs/individuals/pages/default.aspx",
    note: `${APPROX_METHOD} OR: 4.75% / 6.75% / 8.75% / 9.9% (8.75% from ~$11k single), ~$2,800 std deduction, federal-tax subtraction (capped ~$8,500, phased out above $125k), ~$256 personal credit. Portland-area Metro/Multnomah taxes not included.`,
  },
  RI: {
    name: "Rhode Island", kind: "approx", effectiveRate: 0.032, verified: false,
    source: "https://tax.ri.gov/",
    note: `${APPROX_METHOD} RI: 3.75% / 4.75% / 5.99% (indexed), ~$10,900 std deduction + ~$5,100 exemption.`,
  },
  SC: {
    name: "South Carolina", kind: "approx", effectiveRate: 0.044, verified: false,
    source: "https://dor.sc.gov/tax/individual-income",
    note: `${APPROX_METHOD} SC: 0% / 3% / 6% top (2025), on federal taxable income. Any 2026 rate change not confirmed.`,
  },
  VT: {
    name: "Vermont", kind: "approx", effectiveRate: 0.042, verified: false,
    source: "https://tax.vermont.gov/individuals/personal-income-tax",
    note: `${APPROX_METHOD} VT: 3.35% / 6.6% / 7.6% / 8.75% (indexed), ~$7,400 std deduction + ~$5,300 exemption.`,
  },
  VA: {
    name: "Virginia", kind: "approx", effectiveRate: 0.05, verified: false,
    source: "https://www.tax.virginia.gov/individual-income-tax",
    note: `${APPROX_METHOD} VA: 2% / 3% / 5% / 5.75% (5.75% over $17,000), $8,500+ std deduction, $930 exemption.`,
  },
  WV: {
    name: "West Virginia", kind: "approx", effectiveRate: 0.039, verified: false,
    source: "https://tax.wv.gov/Individuals/Pages/default.aspx",
    note: `${APPROX_METHOD} WV: 2.22%-4.82% (after the 2025 cut), $2,000 exemption, no standard deduction. Any further 2026 trigger cut not confirmed.`,
  },
  WI: {
    name: "Wisconsin", kind: "approx", effectiveRate: 0.046, verified: false,
    source: "https://www.revenue.wi.gov/Pages/FAQS/pcs-taxrates.aspx",
    note: `${APPROX_METHOD} WI: 3.5% / 4.4% / 5.3% / 7.65% (5.3% from ~$29k single), sliding standard deduction (partly phased out at $100k), $700 exemption.`,
  },
};
