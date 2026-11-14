"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/kit/Button";
import { Card } from "@/components/kit/Card";
import { cx } from "@/components/kit/cx";
import { Field, MoneyInput, TextInput } from "@/components/kit/Field";
import { ProgressBar } from "@/components/kit/ProgressBar";
import { SegmentedControl } from "@/components/kit/SegmentedControl";
import { longDate, money, moneyCents, pct, shortDate } from "@/lib/product/format";
import { meterLabel, meterPctLabel, meterSegments, penaltyMeter } from "@/lib/product/meter";
import { nextStepText } from "@/lib/product/payNow";
import { FREE_LOG_LIMIT, needsPro } from "@/lib/product/plan";
import { addLogEntry, removeLogEntry, useAddedCount } from "@/lib/product/store";
import type { LogEntry, LogKind } from "@/lib/product/types";
import { setAsideForPayment, type TaxResult } from "@/lib/tax";
import type { PaywallReason } from "./Paywall";
import { ReadPayout } from "./ReadPayout";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
const KIND_OPTIONS = [
  { value: "income", label: "I got paid" },
  { value: "irs", label: "I paid the IRS" },
] as const;
const PAYER_MAX = 60;
const YEAR_START = "2026-01-01";
/** Freelance income counts for tax year 2026 only up to Dec 31 (IRS payments can be made into 2027). */
const YEAR_END = "2026-12-31";

interface Props {
  result: TaxResult;
  log: readonly LogEntry[];
  pro: boolean;
  /** The plan's "today": the date a new entry is logged on. */
  asOf: string;
  onNeedPro: (reason: PaywallReason) => void;
}

type Confirmation = { kind: "income"; amount: number; setAside: number; rate: number; payer: string } | { kind: "irs"; amount: number };

/** The return mechanic: the penalty-proof meter, the "I just got paid" row, and the log of entries. */
export function PaymentLog({ result, log, pro, asOf, onNeedPro }: Props) {
  const meter = penaltyMeter(result, log);
  const segments = meterSegments(meter);
  const label = meterLabel(meter);
  /** Entries ever added to this log (deleting one doesn't free a slot). */
  const added = useAddedCount();

  const [kind, setKind] = useState<LogKind>("income");
  const [amount, setAmount] = useState<number | null>(null);
  const [payer, setPayer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  /** Date the money moved; null = today (asOf). Set when a payout is read. */
  const [date, setDate] = useState<string | null>(null);
  const [readOpen, setReadOpen] = useState(false);
  /** The form was filled from a read payout and hasn't been logged yet. */
  const [filled, setFilled] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (amount === null || !(amount > 0)) {
      setError(kind === "income" ? "Enter the amount you were paid." : "Enter the amount you paid the IRS.");
      return;
    }
    if (kind === "income" && date === null && asOf > YEAR_END) {
      // Today is in 2027: income received now belongs to next year. Show the date field to pick a 2026 date.
      setDate(YEAR_END);
      setError("Income received in 2027 counts toward next year. Enter the 2026 date you were paid.");
      return;
    }
    const when = date ?? asOf;
    const latest = kind === "income" && asOf > YEAR_END ? YEAR_END : asOf;
    if (when < YEAR_START || when > latest) {
      setError(`Use a date between ${longDate(YEAR_START)} and ${longDate(latest)}.`);
      return;
    }
    if (needsPro(added, pro)) {
      onNeedPro("limit");
      return;
    }
    const name = payer.trim().slice(0, PAYER_MAX);
    if (kind === "income") {
      // The rate the person sees right now, from the plan before this payment is added.
      const { setAside, rate } = setAsideForPayment(result, amount);
      addLogEntry({ kind, amount, payer: name, date: when, setAside });
      setConfirmation({ kind, amount, setAside, rate, payer: name });
    } else {
      addLogEntry({ kind, amount, payer: "", date: asOf, setAside: 0 });
      setConfirmation({ kind, amount });
    }
    setAmount(null);
    setPayer("");
    setDate(null);
    setFilled(false);
    setError(null);
  }

  function fillFromPayout(found: { amount: number | null; payer: string | null; date: string | null }) {
    setKind("income");
    setAmount(found.amount);
    setPayer((found.payer ?? "").slice(0, PAYER_MAX));
    setDate(found.date);
    setFilled(true);
    setReadOpen(false);
    setError(null);
    setConfirmation(null);
  }

  function switchKind(next: LogKind) {
    setKind(next);
    setDate(null);
    setFilled(false);
    setError(null);
  }

  const entries = [...log].reverse();
  const used = Math.min(added, FREE_LOG_LIMIT);

  return (
    <Card as="section" raised padding="none" aria-labelledby="meter-title" className="overflow-hidden">
      {/* Meter */}
      <div className="px-5 pt-5 pb-6 sm:px-6 sm:pt-6">
        <h2 id="meter-title" className="text-lg font-bold tracking-[-0.01em] text-accent-ink">
          {label}
        </h2>
        <ProgressBar
          className="mt-3"
          size="lg"
          animateIn
          value={segments.paidPct}
          secondary={segments.setAsidePct}
          tickLabels={QUARTERS}
          label="Penalty-proof progress"
          valueText={label}
        />
        <ul className="mt-4 flex flex-col gap-1.5 text-sm text-ink-2">
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] bg-accent" />
            Paid to IRS <span className="ml-auto font-semibold text-ink">{money(meter.paid)}</span>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="hatch-accent size-2.5 shrink-0 rounded-[3px] ring-1 ring-accent-mid" />
            Set aside <span className="ml-auto font-semibold text-ink">{money(meter.setAside)}</span>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] ring-1 ring-line-strong" />
            Safe-harbor target <span className="ml-auto font-semibold text-ink">{money(meter.target)}</span>
          </li>
        </ul>
      </div>

      {/* Log a payment */}
      <form onSubmit={submit} noValidate className="border-t border-line bg-paper/50 px-5 py-5 sm:px-6">
        <SegmentedControl
          options={KIND_OPTIONS}
          value={kind}
          onChange={switchKind}
          aria-label="What to log"
          size="sm"
          fullWidth
        />

        {readOpen ? (
          <ReadPayout pro={pro} onNeedPro={onNeedPro} onRead={fillFromPayout} onClose={() => setReadOpen(false)} />
        ) : (
          <button
            type="button"
            onClick={() => {
              setReadOpen(true);
              setConfirmation(null);
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="2.5" width="9" height="11" rx="1.5" />
              <path d="M6 6h4M6 8.5h4M6 11h2" />
            </svg>
            Paste a payout email or screenshot
          </button>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-[8.25rem_minmax(0,1fr)] items-center gap-x-3">
            <span aria-hidden className="whitespace-nowrap text-base font-medium text-ink-2">
              {kind === "income" ? "I just got paid" : "I paid the IRS"}
            </span>
            <Field label={kind === "income" ? "Amount you were paid" : "Amount you paid the IRS"} hideLabel>
              <MoneyInput
                value={amount}
                onValueChange={(v) => {
                  setAmount(v);
                  setError(null);
                  setConfirmation(null);
                }}
                invalid={error !== null}
                aria-describedby={error ? "log-error" : undefined}
                enterKeyHint="done"
              />
            </Field>
          </div>
          {kind === "income" && (
            <div className="grid grid-cols-[8.25rem_minmax(0,1fr)] items-center gap-x-3">
              <span aria-hidden className="text-right text-base font-medium text-ink-2">
                from
              </span>
              <Field label="Who paid you (optional)" hideLabel>
                <TextInput
                  value={payer}
                  maxLength={PAYER_MAX}
                  onChange={(e) => setPayer(e.target.value)}
                  placeholder="Client (optional)"
                  autoComplete="organization"
                  enterKeyHint="done"
                />
              </Field>
            </div>
          )}
          {kind === "income" && date !== null && (
            <div className="grid grid-cols-[8.25rem_minmax(0,1fr)] items-center gap-x-3">
              <span aria-hidden className="text-right text-base font-medium text-ink-2">
                on
              </span>
              <Field label="Date you were paid" hideLabel>
                <TextInput
                  type="date"
                  className="[&_input]:pr-2 [&_input]:pl-3"
                  value={date}
                  min={YEAR_START}
                  max={asOf > YEAR_END ? YEAR_END : asOf}
                  onChange={(e) => {
                    setDate(e.target.value || null);
                    setError(null);
                  }}
                />
              </Field>
            </div>
          )}
          {kind === "income" && filled && (
            <p className="flex items-center gap-2 rounded-md bg-amber-soft px-3 py-2 text-sm font-medium text-amber">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-amber-mid" />
              Check these before logging.
            </p>
          )}
          {kind === "irs" && (
            <p className="text-sm text-ink-2">A 2026 estimated payment, dated {longDate(asOf)}. It comes out of what you set aside.</p>
          )}
          {error && (
            <p id="log-error" role="alert" className="text-sm font-medium text-red">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth>
            {kind === "income" ? "Log payment" : "Log IRS payment"}
          </Button>
        </div>

        <div aria-live="polite" aria-atomic>
          {confirmation && (
            <div className="mt-4 animate-[pp-step-in_300ms_var(--ease-out-soft)_both] rounded-md border border-accent-mid/60 bg-accent-soft px-4 py-3">
              {confirmation.kind === "income" ? (
                <>
                  <p className="text-lg font-bold text-accent-ink">
                    Set aside {moneyCents(confirmation.setAside)} from this payment
                  </p>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {pct(confirmation.rate, 0)} of {moneyCents(confirmation.amount)}
                    {confirmation.payer ? ` from ${confirmation.payer}` : ""}. Move it to savings now. You&rsquo;re {meterPctLabel(meter)}% penalty-proof.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-accent-ink">Logged {moneyCents(confirmation.amount)} paid to the IRS</p>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {nextStepText(result)}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Entries */}
      <div className="border-t border-line px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-base font-semibold text-ink">Your log</h3>
          {pro ? (
            <p className="text-sm text-accent-ink">Pro: unlimited logging</p>
          ) : (
            <p className="text-sm text-ink-2">
              {used} of {FREE_LOG_LIMIT} free entries used{added > log.length ? ", deleted ones included" : ""}
              <span aria-hidden> · </span>
              <button
                type="button"
                onClick={() => onNeedPro("upgrade")}
                className="rounded-sm font-semibold text-accent underline-offset-4 hover:underline"
              >
                Get unlimited
              </button>
            </p>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">
            Nothing logged yet. When a client pays you, log it here to see what to set aside from it.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {entries.map((e) => (
              <LogRow key={e.id} entry={e} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const income = entry.kind === "income";
  const title = income ? entry.payer || "Client payment" : "Paid to the IRS";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-b border-line py-3 last:border-b-0">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-3">
          {shortDate(entry.date)}
          {income && <> · set aside {moneyCents(entry.setAside)}</>}
        </span>
      </span>
      <span className={cx("text-sm font-semibold", income ? "text-ink" : "text-accent-ink")}>
        {moneyCents(entry.amount)}
      </span>
      <button
        type="button"
        onClick={() => removeLogEntry(entry.id)}
        aria-label={`Remove ${title}, ${moneyCents(entry.amount)}`}
        className="-mr-1.5 flex size-9 items-center justify-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </li>
  );
}
