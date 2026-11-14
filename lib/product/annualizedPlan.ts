// The "Paid unevenly?" card (Pro): Form 2210 Schedule AI next to the regular schedule.
// This module only builds the engine input and picks numbers out of the engine's results; the tax maths is
// all in lib/tax (`annualized`, `estimate`).

import { annualized, estimate, type AnnualizedResult, type DatedAmount, type TaxInput, type TaxResult } from "@/lib/tax";
import { buildTaxInput } from "./input";
import type { LogEntry, Profile } from "./types";

/** Cents below which two engine amounts count as equal. */
const EPSILON = 0.5;

/**
 * Dated freelance payments for Schedule AI: every logged income entry on its own date, plus the quiz's
 * "paid so far" (profile.ytdIncome) spread in equal monthly amounts on the 15th of each month from January to
 * the month of `asOf` (December when `asOf` is in 2027). A 15th later than `asOf` is dated `asOf`, so nothing is
 * dated in the future. The monthly amounts are in cents and the last one takes the rounding, so they add up to
 * ytdIncome exactly.
 */
export function payments1099(profile: Profile, log: readonly LogEntry[], asOf: string): DatedAmount[] {
  const out: DatedAmount[] = [];
  if (profile.ytdIncome > 0) {
    const year = Number(asOf.slice(0, 4));
    const months = year > 2026 ? 12 : Number(asOf.slice(5, 7));
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
  const rows: AnnualizedRow[] = result.installments.map((a, idx) => ({
    quarter: a.quarter,
    due: a.due,
    regular: regular.installments[idx]?.required ?? 0,
    annualized: a.required,
    past: nextQuarter === null || a.quarter < nextQuarter,
    next: a.quarter === nextQuarter,
  }));

  let headline: AnnualizedHeadline;
  if (result.requiredAnnualPayment <= 0) {
    headline = { kind: "noneRequired" };
  } else {
    const nextRow = nextQuarter === null ? null : result.installments.find((i) => i.quarter === nextQuarter) ?? null;
    const atNext = nextRow ? lessBy(nextRow) : 0;
    if (nextRow && atNext >= EPSILON) {
      headline = { kind: "lessByNext", amount: atNext, due: nextRow.due };
    } else {
      // The largest saving at a due date that has already passed.
      let best: { amount: number; due: string } | null = null;
      for (const i of result.installments) {
        if (nextQuarter !== null && i.quarter >= nextQuarter) break;
        const v = lessBy(i);
        if (v >= EPSILON && (!best || v > best.amount)) best = { amount: v, due: i.due };
      }
      headline = best
        ? { kind: "lessEarlier", amount: best.amount, due: best.due, nextDue: nextRow?.due ?? null }
        : { kind: "regularBest" };
    }
  }
  return { result, rows, headline };
}

/** The annualized plan for this profile and log as of `asOf`. Throws TaxInputError like `estimate`. */
export function computeAnnualizedPlan(profile: Profile, log: readonly LogEntry[], asOf: string): AnnualizedPlan {
  const input = buildAnnualizedInput(profile, log, asOf);
  return { input, ...summarizeAnnualized(annualized(input), estimate(input)) };
}
