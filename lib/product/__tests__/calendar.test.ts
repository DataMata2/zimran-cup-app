import { describe, expect, it } from "vitest";
import { estimate, estimateAccruedPenalty, toICS, type TaxResult } from "@/lib/tax";
import { calendarFile, calendarNote } from "@/lib/product/calendar";
import { buildExample } from "@/lib/product/example";
import { buildTaxInput } from "@/lib/product/input";
import { pastDue, payNowPlan } from "@/lib/product/payNow";
import type { LogEntry, Profile } from "@/lib/product/types";

const AS_OF = "2026-11-14";

function maya(): TaxResult {
  const { profile, entry } = buildExample(AS_OF, new Date("2026-11-14T12:00:00Z"));
  const log: LogEntry[] = [{ ...entry, id: "e1", createdAt: "2026-11-14T12:00:00.000Z" }];
  return estimate(buildTaxInput(profile, log, AS_OF));
}

interface Vevent {
  props: Map<string, string>;
  raw: string;
}

/** Unfold (RFC 5545 3.1) and split into VEVENTs; property names keep their parameters (e.g. "DTSTART;VALUE=DATE"). */
function events(ics: string): Vevent[] {
  const lines = ics.replace(/\r\n /g, "").split("\r\n");
  const out: Vevent[] = [];
  let cur: Vevent | null = null;
  let inAlarm = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = { props: new Map(), raw: "" };
    else if (line === "END:VEVENT" && cur) {
      out.push(cur);
      cur = null;
    }
    else if (line === "BEGIN:VALARM") inAlarm = true;
    else if (line === "END:VALARM") inAlarm = false;
    else if (cur && !inAlarm) {
      const i = line.indexOf(":");
      cur.props.set(line.slice(0, i), line.slice(i + 1));
    }
    if (cur) cur.raw += line + "\n";
  }
  return out;
}

/** The dollar amount in a SUMMARY ("$1\,850" or "$1850.00"). */
function amountOf(summary: string): number {
  const m = /\$([\d\\,]+(?:\.\d+)?)/.exec(summary);
  return m ? Number(m[1]!.replace(/[\\,]/g, "")) : NaN;
}

function dateOf(e: Vevent): string {
  for (const [k, v] of e.props) if (k.startsWith("DTSTART")) return v.slice(0, 8);
  return "";
}

function expectWellFormed(ics: string) {
  expect(ics.endsWith("\r\n")).toBe(true);
  expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/); // only CRLF line breaks
  const lines = ics.slice(0, -2).split("\r\n");
  for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  const stack: string[] = [];
  for (const line of lines) {
    if (line.startsWith("BEGIN:")) stack.push(line.slice(6));
    if (line.startsWith("END:")) expect(stack.pop()).toBe(line.slice(4));
  }
  expect(stack).toEqual([]);
  expect(lines[0]).toBe("BEGIN:VCALENDAR");
  expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
  for (const e of events(ics)) {
    expect(e.props.get("UID")).toMatch(/@penaltyproof$/);
    expect(e.props.get("DTSTAMP")).toMatch(/^\d{8}T\d{6}Z$/);
    expect(e.raw).toContain("BEGIN:VALARM");
  }
  const uids = events(ics).map((e) => e.props.get("UID"));
  expect(new Set(uids).size).toBe(uids.length);
}

describe("calendarFile with a missed quarter (Maya)", () => {
  const result = maya();
  const plan = payNowPlan(result, estimateAccruedPenalty(result))!;
  const ics = calendarFile(result);
  const evs = events(ics);

  it("starts with a pay-now event for tomorrow at 09:00 local, at the hero's missed amount", () => {
    expect(plan.quarters).toEqual([3]);
    const first = evs[0]!;
    expect(first.props.get("SUMMARY")).toBe(`Pay missed Q3 estimated tax: $${plan.amount.toFixed(2)}`);
    expect(first.props.get("SUMMARY")).toBe("Pay missed Q3 estimated tax: $1850.00");
    expect(first.props.get("DTSTART")).toBe("20261115T090000");
    expect(first.props.get("DTEND")).toBe("20261115T093000");
    expect(amountOf(first.props.get("SUMMARY")!)).toBe(Math.round(plan.amount));
  });

  it("gives the next deadline its own instalment, not the lump", () => {
    const then = plan.then!;
    const next = evs.find((e) => e.props.get("UID") === `penaltyproof-2026-q${then.quarter}@penaltyproof`)!;
    expect(dateOf(next)).toBe(then.due.replace(/-/g, ""));
    expect(amountOf(next.props.get("SUMMARY")!)).toBeCloseTo(then.amount, 2);
    expect(next.props.get("DESCRIPTION")).not.toContain("includes an underpaid");
    expect(amountOf(next.props.get("SUMMARY")!)).toBeLessThan(result.nextDeadline!.amountDue);
  });

  it("sums the pay events through the next deadline to the hero's total", () => {
    const then = plan.then!;
    const upTo = evs.filter((e) => dateOf(e) <= then.due.replace(/-/g, "") && e.props.get("SUMMARY")!.startsWith("Pay"));
    expect(upTo).toHaveLength(2);
    const sum = upTo.reduce((s, e) => s + amountOf(e.props.get("SUMMARY")!), 0);
    expect(sum).toBeCloseTo(Math.round(plan.amount) + then.amount, 0);
    expect(Math.round(sum)).toBe(Math.round(plan.amount + then.amount));
  });

  it("keeps the April 15, 2027 return event as the engine writes it", () => {
    const engine = events(toICS(result, { includeReturnDue: true }));
    const ret = (list: Vevent[]) => list.find((e) => e.props.get("UID") === "penaltyproof-2026-return@penaltyproof")!.raw;
    expect(ret(evs)).toBe(ret(engine));
  });

  it("is well-formed ICS", () => expectWellFormed(ics));

  it("describes the file next to the button", () => {
    expect(calendarNote(result)).toBe(
      "A reminder tomorrow at 9 AM to pay the missed Q3 amount ($1,850), then each remaining deadline with its own amount and a reminder 3 days before.",
    );
  });
});

describe("calendarFile with several missed quarters", () => {
  it("words the pay-now event like the hero (Q1–Q3)", () => {
    const profile: Profile = {
      filingStatus: "single",
      state: "TX",
      ytdIncome: 50000,
      expectedIncome: 60000,
      w2Wages: 0,
      w2Withholding: 0,
      priorYearTax: 8000,
      priorYearAgi: 50000,
      estimatedPaid: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      isExample: false,
    };
    const result = estimate(buildTaxInput(profile, [], AS_OF));
    const due = pastDue(result)!;
    expect(due.quarters).toEqual([1, 2, 3]);
    const ics = calendarFile(result);
    expect(events(ics)[0]!.props.get("SUMMARY")).toBe(`Pay missed Q1–Q3 estimated tax: $${due.amount.toFixed(2)}`);
    expectWellFormed(ics);
  });
});

describe("calendarFile with nothing past due", () => {
  it("is exactly the engine's calendar", () => {
    const profile: Profile = {
      filingStatus: "single",
      state: "TX",
      ytdIncome: 50000,
      expectedIncome: 60000,
      w2Wages: 0,
      w2Withholding: 0,
      priorYearTax: 8000,
      priorYearAgi: 50000,
      estimatedPaid: 6000,
      createdAt: "2026-07-01T00:00:00.000Z",
      isExample: false,
    };
    const result = estimate(buildTaxInput(profile, [], AS_OF));
    expect(pastDue(result)).toBeNull();
    const ics = calendarFile(result);
    expect(ics).toBe(toICS(result, { includeReturnDue: true }));
    expectWellFormed(ics);
    expect(calendarNote(result)).toBe("Each remaining deadline with its amount, plus a reminder 3 days before.");
  });
});
