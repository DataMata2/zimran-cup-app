// The number guard for the AI text routes (/api/explain, /api/ask). Every number the model writes must be
// one the facts it was given contain; the handlers buffer the whole answer, check it here, and only then
// send it. Pure: no SDK, no Next.
//
// What counts as the same number: "$1,850" = "$1850" = "$1,850.00"; a fact "$2,340.50" also allows the whole
// dollars "$2,340" / "$2,341"; a percent may be the fact's percent rounded ("20.4%" allows "20%"). Dollar
// amounts are checked only against dollar amounts in the facts (so "Jan 15" can't vouch for "$15"), percents
// only against percents (a derived percent passes only if the facts have it), and plain numbers (dates,
// years, quarters, counts) against any number in the facts. Numbers the person typed themselves (Ask) are
// allowed in any form. IRS form names (Form 1040-ES, 2210, 1099, W-2) are not amounts and are skipped.

import type { PlanFacts } from "./ai-prompts";

export type NumberKind = "dollar" | "percent" | "plain";

export interface FoundNumber {
  /** The text as written, e.g. "$1,850.00" or "20%". */
  raw: string;
  kind: NumberKind;
  value: number;
}

const FORM_NAMES = /\b(?:Form\s+)?(?:1040(?:-ES|-SR)?|1099(?:-[A-Z]+)?|2210|W-2|W-4)\b/g;
const NUMBER = /(\$\s?)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\s?%|\s?percent\b)?/gi;

/** Every number in `text`: dollar amounts, percentages and plain numbers, in order. */
export function extractNumbers(text: string): FoundNumber[] {
  const out: FoundNumber[] = [];
  const cleaned = text.replace(FORM_NAMES, " ");
  for (const m of cleaned.matchAll(NUMBER)) {
    const value = Number(m[2]!.replace(/,/g, "") + (m[3] ?? ""));
    if (!Number.isFinite(value)) continue;
    const kind: NumberKind = m[1] ? "dollar" : m[4] ? "percent" : "plain";
    out.push({ raw: m[0].trim(), kind, value });
  }
  return out;
}

/** A value as integer cents, the key every comparison uses (float-safe). */
const key = (n: number) => Math.round(n * 100);

/** What the sources allow, per kind. */
export interface AllowedNumbers {
  dollars: Set<number>;
  percents: number[];
  any: Set<number>;
  /** The figures as written in the facts, for the stricter retry instruction. */
  figures: string[];
}

function addValue(set: Set<number>, value: number) {
  set.add(key(value));
  // Whole-dollar versions of an amount with cents: truncated and rounded.
  set.add(key(Math.trunc(value)));
  set.add(key(Math.round(value)));
}

/** The numbers allowed by `facts` (strict, per kind) and by `loose` text (the person's own words, any kind). */
export function allowedNumbers(facts: readonly string[], loose: readonly string[] = []): AllowedNumbers {
  const dollars = new Set<number>([0]);
  const percents: number[] = [];
  const any = new Set<number>([0]);
  const figures = new Set<string>();
  for (const s of facts) {
    for (const n of extractNumbers(s)) {
      addValue(any, n.value);
      if (n.kind === "dollar") {
        addValue(dollars, n.value);
        figures.add(n.raw);
      } else if (n.kind === "percent") {
        percents.push(n.value);
        figures.add(n.raw);
      }
    }
  }
  for (const s of loose) {
    for (const n of extractNumbers(s)) {
      addValue(any, n.value);
      addValue(dollars, n.value);
      percents.push(n.value);
    }
  }
  return { dollars, percents, any, figures: [...figures] };
}

function isAllowed(n: FoundNumber, allowed: AllowedNumbers): boolean {
  switch (n.kind) {
    case "dollar":
      return allowed.dollars.has(key(n.value));
    case "percent":
      return allowed.percents.some(
        (p) => key(p) === key(n.value) || Math.round(p) === n.value || key(Math.round(p * 10) / 10) === key(n.value),
      );
    case "plain":
      return allowed.any.has(key(n.value));
  }
}

/** The numbers in `text` the sources don't allow (made up or computed by the model). Empty = the text passes. */
export function unknownNumbers(text: string, facts: readonly string[], loose: readonly string[] = []): FoundNumber[] {
  const allowed = allowedNumbers(facts, loose);
  return extractNumbers(text).filter((n) => !isAllowed(n, allowed));
}

/** The extra instruction for the one retry after a failed check. */
export function stricterInstruction(facts: readonly string[], unknown: readonly FoundNumber[]): string {
  const figures = allowedNumbers(facts).figures.slice(0, 120);
  return `\n\nYour previous answer used numbers that are not in the plan (${unknown.map((n) => n.raw).join(", ")}). Write it again. Use only these exact figures: ${figures.join(", ")}. Copy them exactly as written; do not write any other amount or percentage, and do not calculate.`;
}

// ---------------------------------------------------------------------------------------------------
// Fallbacks when the retry fails too: built only from the facts' own strings, so they pass the check.

/** The deterministic explanation: the screen's own sentences in order. */
export function templateExplanation(facts: PlanFacts): string {
  const h = facts.headline as Record<string, unknown> & { says: string };
  const parts: string[] = [h.says];
  if (typeof h.pastDue === "string") parts.push(h.pastDue);
  const then = h.thenAlsoPay as { label: string; amount: string; by: string } | null | undefined;
  if (then) parts.push(`${then.label}: ${then.amount} by ${then.by}.`);
  const accrued = h.accruedPenalty as { says: string } | undefined;
  if (accrued) parts.push(accrued.says);
  parts.push(facts.safeHarbor.says);
  parts.push(facts.setAside.says);
  parts.push("Money you set aside is only saved; only payments to the IRS protect you from the underpayment penalty.");
  parts.push(aprilLine(facts));
  return parts.map((p) => p.trim()).filter(Boolean).join(" ");
}

function aprilLine(facts: PlanFacts): string {
  const a = facts.aprilReturn as { due: string; owedWithReturn?: string; refundExpected?: string };
  if (a.refundExpected) return `With your return on ${a.due}, expect a federal refund of about ${a.refundExpected}. State tax is separate.`;
  if (a.owedWithReturn && a.owedWithReturn !== "$0")
    return `With your return on ${a.due}, expect to owe about ${a.owedWithReturn} in federal tax. State tax is separate.`;
  return `With your return on ${a.due}, no more federal tax is expected. State tax is separate.`;
}

export const ASK_SAFE_ANSWER = "I can only answer with the numbers in your plan.";

/** The safe Ask answer: the fixed sentence plus the plan line closest to the question. */
export function safeAskAnswer(facts: PlanFacts, question: string): string {
  const q = question.toLowerCase();
  let line: string;
  if (/set(?:\s|-)?aside|sav(e|ing)|percent|%|rate/.test(q)) line = facts.setAside.says;
  else if (/april|return|refund|owe|balance/.test(q)) line = aprilLine(facts);
  else if (/safe.?harbor|why|required|minimum|rule/.test(q)) line = facts.safeHarbor.says;
  else line = facts.headline.says;
  return `${ASK_SAFE_ANSWER} ${line}`;
}
