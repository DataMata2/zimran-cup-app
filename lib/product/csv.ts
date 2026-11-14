// "Export for your accountant" (Pro): the payment log, the instalments and the tax breakdown as one CSV.
// Built in the browser. Every amount is copied from the engine's results or the log (split into pay-now and
// the next instalment by ./payNow, as on screen); nothing is computed here.

import type { AnnualizedResult, InstallmentStatus, SafeHarborRule, TaxResult } from "@/lib/tax";
import { installmentRow, missedLabel, nextLabel, pastDue, payTarget } from "./payNow";
import type { LogEntry } from "./types";

export const CSV_FILENAME = "penaltyproof-2026.csv";

type Cell = string | number | null;

/** Characters that make a spreadsheet treat a text cell as a formula (plus tab and CR, per OWASP). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV field (RFC 4180). Numbers are written with 2 decimals and no thousands separator, so a spreadsheet
 * reads them as numbers. Text that starts like a formula gets a leading apostrophe so it stays text; text with a
 * quote, comma or line break is quoted with inner quotes doubled.
 */
export function csvField(value: Cell): string {
  if (value === null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2) : "";
  let s = value;
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV text with CRLF line endings. */
export function csvRows(rows: readonly (readonly Cell[])[]): string {
  return rows.map((r) => r.map(csvField).join(",")).join("\r\n");
}

const STATUS: Record<InstallmentStatus, string> = { paid: "Paid", due: "Due", pastDue: "Past due", upcoming: "Upcoming" };
const RULE: Record<SafeHarborRule, string> = {
  current90: "90% of 2026 tax",
  prior100: "100% of 2025 tax",
  prior110: "110% of 2025 tax",
  noneRequired: "No estimated payments required",
};

export interface CsvData {
  log: readonly LogEntry[];
  result: TaxResult;
  /** The annualized (Schedule AI) instalments, when available. */
  annualized?: AnnualizedResult | null;
  /** Date of the export (YYYY-MM-DD), the plan's asOf. */
  asOf: string;
}

/** The whole export: a title block, then the log, the instalments and the tax breakdown, a blank row between. */
export function buildCsv({ log, result, annualized, asOf }: CsvData): string {
  const { tax, income, safeHarbor } = result;
  const rows: Cell[][] = [
    ["Penaltyproof: 2026 estimated tax"],
    ["Prepared", asOf],
    ["Estimate for tax year 2026, not tax advice."],
    [],
    ["Payment log"],
    ["Date", "Type", "Payer", "Amount", "Set aside"],
    ...[...log]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((e): Cell[] => [
        e.date,
        e.kind === "income" ? "Income received" : "Estimated tax paid to IRS",
        e.payer || null,
        e.amount,
        e.kind === "income" ? e.setAside : null,
      ]),
    [],
    ["Federal estimated tax instalments (Form 1040-ES, regular method: equal quarterly payments)"],
    // "To pay" matches the /plan deadlines (PP-QA-11): a missed row shows what is still unpaid on it, the next
    // deadline only its own instalment (the past-due part is paid now, below), a covered row 0.
    ["Quarter", "Due", "Required", "Credited", "To pay", "Note", "Status"],
    ...result.installments.map((i): Cell[] => {
      const row = installmentRow(result, i);
      const toPay = row.note === "Covered" ? 0 : row.amount;
      return [`Q${i.quarter}`, i.due, i.required, i.paymentsCredited + i.withholdingCredited, toPay, row.note, STATUS[i.status]];
    }),
  ];

  // What to pay and when, as the hero says it: the missed amount now, then the next quarterly payment.
  const due = pastDue(result);
  const target = payTarget(result);
  if (due || target) {
    rows.push([], ["What to pay"], ["Payment", "When", "Amount"]);
    if (due) rows.push([missedLabel(due.quarters), "Now (past due)", due.amount]);
    if (target) rows.push([nextLabel(target.quarter), target.due, target.amount]);
  }

  if (annualized && annualized.requiredAnnualPayment > 0) {
    rows.push(
      [],
      ["Annualized instalments (Form 2210 Schedule AI): for comparison only; the instalments above use the regular method"],
      ["Quarter", "Due", "Annualized AGI", "Required (line 25)"],
      ...annualized.installments.map((i): Cell[] => [`Q${i.quarter}`, i.due, i.annualizedIncome, i.required]),
    );
  }

  rows.push(
    [],
    ["Tax breakdown, full year 2026"],
    ["Item", "Amount"],
    ["Freelance profit", income.net1099Annual],
    ["W-2 wages", income.w2Wages],
    ["Adjusted gross income", income.agi],
    ["Standard deduction", income.standardDeduction],
    ["QBI deduction", income.qbiDeduction],
    ["Taxable income", income.taxableIncome],
    ["Self-employment tax", tax.seTax],
    ["Federal income tax", tax.federalIncomeTax],
    ["Additional Medicare tax", tax.additionalMedicare],
    ["Federal total", tax.federalTotal],
    ["State income tax", tax.state],
    ["Total tax", tax.total],
    ["Safe-harbor rule", RULE[safeHarbor.rule]],
    ["Required annual payment (safe harbor)", safeHarbor.requiredAnnualPayment],
    ["Estimated balance with the return (negative = refund)", result.aprilTrueUp],
  );

  // BOM so Excel opens non-ASCII payer names as UTF-8.
  return `\uFEFF${csvRows(rows)}\r\n`;
}

/** Download `text` as the export file (browser only). */
export function downloadCsv(text: string, filename: string = CSV_FILENAME): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Late enough for iOS Safari's Download / View prompt, which reads the URL after the click.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
