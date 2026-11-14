// The "Paid unevenly?" card (Pro): Form 2210 Schedule AI next to the regular schedule.
// This module only builds the engine input and picks numbers out of the engine's results; the tax maths is
// all in lib/tax (`annualized`, `estimate`).

import { annualized, estimate, type AnnualizedResult, type DatedAmount, type TaxInput, type TaxResult } from "@/lib/tax";
import { buildTaxInput } from "./input";
import { MIN_SHOWN, pastDue, quarterList } from "./payNow";
import type { LogEntry, Profile } from "./types";

/** PP-QA-02: the card's label for the method and its assumption. */
export const ANNUALIZED_METHOD_LABEL =
  "Annualized method: if most of your income came late in the year, the IRS lets you pay less early. Uses the dates of the client payments you logged; the profit you entered in the questions is counted as earned evenly from January to the month you answered.";

/** Smallest saving worth a headline: a whole dollar (smaller differences are rounding). */
const MIN_SAVING = 1;

/**
 * Dated freelance payments for Schedule AI: every logged income entry on its own date, plus the quiz's
 * "paid so far" (profile.ytdIncome) spread in equal monthly amounts on the 15th of each month from January to
 * the month the quiz was answered (profile.createdAt). That month is clamped to January..the month of `asOf`,
 * and to December 2026. ytdIncome is what had been received by the quiz, so spreading it to a later month
 * would invent late income. A 15th later than `asOf` is dated `asOf`, so nothing is dated in the future. The
 * monthly amounts are in cents and the last one takes the rounding, so they add up to ytdIncome exactly.
 */
export function payments1099(profile: Profile, log: readonly LogEntry[], asOf: string): DatedAmount[] {
  const out: DatedAmount[] = [];
  if (profile.ytdIncome > 0) {
    const months = Math.min(monthIn2026(profile.createdAt), monthIn2026(asOf));
    const totalCents = Math.round(profile.ytdIncome * 100);
    const each = Math.floor(totalCents / months);
    for (let m = 1; m <= months; m++) {
      const cents = m === months ? totalCents - each * (months - 1) : each;
      const fifteenth = `2026-${String(m).padStart(2, "0")}-15`;
      out.push({ date: fifteenth > asOf ? asOf : fifteenth, amount: cents / 100 });
    }
  }
  for (const e of log) {
    if (e.kind === "income") out.push({ date: e.date, amount: e.amount });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Month (1..12) of an ISO date or timestamp within 2026: earlier years give 1, later years 12. */
function monthIn2026(iso: string): number {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  if (!Number.isFinite(year) || !(month >= 1 && month <= 12)) return 12;
  return year < 2026 ? 1 : year > 2026 ? 12 : month;
}

/** The engine input for the annualized plan: the usual input plus the dated payments above. */
export function buildAnnualizedInput(profile: Profile, log: readonly LogEntry[], asOf: string): TaxInput {
  return { ...buildTaxInput(profile, log, asOf), payments1099: payments1099(profile, log, asOf) };
}

export interface AnnualizedRow {
  quarter: 1 | 2 | 3 | 4;
  due: string;
  /** Regular method: 25% of the required annual payment (estimate()). */
  regular: number;
  /** Annualized method: Schedule AI line 25 (annualized()). */
  annualized: number;
  /** This row's due date has passed (before the next deadline). */
  past: boolean;
  /** This is the next deadline. */
  next: boolean;
  /**
   * Show the annualized amount. False for a passed quarter whose annualized requirement is $0 while the regular
   * plan (the hero) has a past-due amount: a bare "$0" there would contradict "pay now", so the card shows
   * `reconciliation` instead (PP-QA-02).
   */
  showAnnualized: boolean;
}

export type AnnualizedHeadline =
  /** By the next due date the annualized method asks `amount` less in total. */
  | { kind: "lessByNext"; amount: number; due: string }
  /**
   * Both methods ask the same total by the next due date, but the annualized one asked `amount` less by an
   * earlier, already passed due date (which lowers a late-payment penalty).
   */
  | { kind: "lessEarlier"; amount: number; due: string; nextDue: string | null }
  /** Income is even enough that the annualized method never asks less. */
  | { kind: "regularBest" }
  /** No estimated payments are required, so there is nothing to annualize. */
  | { kind: "noneRequired" };

export interface AnnualizedPlan {
  input: TaxInput;
  result: AnnualizedResult;
  rows: AnnualizedRow[];
  headline: AnnualizedHeadline;
  /** The one line shown instead of the hidden $0 rows, or null when every row is shown. */
  reconciliation: string | null;
}

/**
 * Cumulative amount the annualized method asks less than the regular one by each due date, straight from the
 * engine: Schedule AI line 24 (regular instalment plus carryover) minus line 25 (required) is the unused regular
 * amount carried forward, which equals the cumulative regular required minus the cumulative annualized required.
 */
function lessBy(i: AnnualizedResult["installments"][number]): number {
  return Math.max(0, i.regularInstallment - i.required);
}

/** Pick the rows and the headline from the two engine results for the same input. */
export function summarizeAnnualized(result: AnnualizedResult, regular: TaxResult): Omit<AnnualizedPlan, "input"> {
  const nextQuarter = regular.nextDeadline?.quarter ?? null;
  const heroPastDue = pastDue(regular) !== null;
  const rows: AnnualizedRow[] = result.installments.map((a, idx) => {
    const past = nextQuarter === null || a.quarter < nextQuarter;
    return {
      quarter: a.quarter,
      due: a.due,
      regular: regular.installments[idx]?.required ?? 0,
      annualized: a.required,
      past,
      next: a.quarter === nextQuarter,
      showAnnualized: !(heroPastDue && past && a.required < MIN_SHOWN),
    };
  });
  const hidden = rows.filter((r) => !r.showAnnualized).map((r) => r.quarter);
  const reconciliation =
    hidden.length > 0
      ? `Under this method your ${quarterList(hidden)} requirement is lower; you’d file Form 2210 Schedule AI.`
      : null;

  let headline: AnnualizedHeadline;
  if (result.requiredAnnualPayment <= 0) {
    headline = { kind: "noneRequired" };
  } else {
    const nextRow = nextQuarter === null ? null : result.installments.find((i) => i.quarter === nextQuarter) ?? null;
    const atNext = nextRow ? lessBy(nextRow) : 0;
    if (nextRow && atNext >= MIN_SAVING) {
      headline = { kind: "lessByNext", amount: atNext, due: nextRow.due };
    } else {
      // The largest saving at a due date that has already passed.
      let best: { amount: number; due: string } | null = null;
      for (const i of result.installments) {
        if (nextQuarter !== null && i.quarter >= nextQuarter) break;
        const v = lessBy(i);
        if (v >= MIN_SAVING && (!best || v > best.amount)) best = { amount: v, due: i.due };
      }
      headline = best
        ? { kind: "lessEarlier", amount: best.amount, due: best.due, nextDue: nextRow?.due ?? null }
        : { kind: "regularBest" };
    }
  }
  return { result, rows, headline, reconciliation };
}

/** The annualized plan for this profile and log as of `asOf`. Throws TaxInputError like `estimate`. */
export function computeAnnualizedPlan(profile: Profile, log: readonly LogEntry[], asOf: string): AnnualizedPlan {
  const input = buildAnnualizedInput(profile, log, asOf);
  return { input, ...summarizeAnnualized(annualized(input), estimate(input)) };
}
