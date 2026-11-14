import Link from "next/link";
import { cx } from "@/components/kit/cx";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { money, pct } from "@/lib/product/format";
import { planNotes } from "@/lib/product/plan";
import { zeroStateTaxNote } from "@/lib/product/stateNote";
import { stateName } from "@/lib/product/states";
import { ENGINE_TEST_COUNT, VERIFIED_URL } from "@/lib/product/trust";
import type { StateCode, TaxResult } from "@/lib/tax";

/** Where the set-aside rate comes from: the year's tax by kind, the total and the effective rate. */
export function Breakdown({ result, state, className }: { result: TaxResult; state: StateCode; className?: string }) {
  const { tax, income, rates } = result;
  const { notes: flagNotes, footnotes } = planNotes(result.flags);
  const stateNote = zeroStateTaxNote(result, state);
  const notes = stateNote ? [...flagNotes, { code: "state_zero_note", message: stateNote }] : flagNotes;
  const stateLabel =
    tax.stateMethod === "none"
      ? `${stateName(state)} has no state income tax`
      : `${stateName(state)} income tax${tax.stateMethod === "approx" ? " (approximate)" : ""}`;

  const rows: { label: string; value: string }[] = [
    { label: "Self-employment tax", value: money(tax.seTax) },
    { label: "Federal income tax", value: money(tax.federalIncomeTax) },
    ...(tax.additionalMedicare > 0 ? [{ label: "Additional Medicare tax", value: money(tax.additionalMedicare) }] : []),
    { label: stateLabel, value: money(tax.state) },
  ];

  return (
    <section aria-labelledby="breakdown-title" className={cx("min-w-0", className)}>
      <h2 id="breakdown-title" className="font-display text-2xl leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[1.75rem]">
        Your 2026 tax, estimated
      </h2>
      <p className="mt-2 text-base text-ink-2">
        On {money(income.net1099Annual)} of freelance profit for the year{income.projected ? " (projected from what you've been paid so far)" : ""}.
      </p>

      <dl className="mt-5 rounded-lg border-3 border-ink bg-surface px-4 shadow-hard sm:px-6">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-ink py-3.5 text-base">
            <dt className="text-ink-2">{r.label}</dt>
            <dd className="font-bold text-ink tabular-nums">{r.value}</dd>
          </div>
        ))}
        <div className="-mt-px flex items-baseline justify-between gap-4 border-y-3 border-ink py-4">
          <dt className="font-display text-lg font-extrabold text-ink">Total</dt>
          <dd className="font-display text-2xl leading-none font-extrabold tracking-[-0.02em] text-ink tabular-nums">{money(tax.total)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3.5 text-base">
          <dt className="text-ink-2">Effective rate on freelance profit</dt>
          <dd className="font-bold text-ink tabular-nums">{pct(rates.effectiveOnFreelance)}</dd>
        </div>
      </dl>

      {notes.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2">
          {notes.map((f) => (
            <li key={f.code} className="flex gap-2.5 text-sm text-ink-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" />
              <span className="max-w-[68ch]">{f.message}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-sm text-ink">
        Tax maths matches the IRS Form 1040-ES worksheet to the cent:{" "}
        <Link
          href={VERIFIED_URL}
          className="-my-3 inline-block rounded-sm py-3 font-bold text-ink underline decoration-2 underline-offset-4 hover:bg-ink/5"
        >
          {ENGINE_TEST_COUNT} tests
        </Link>
        .
      </p>

      <div className="mt-5 flex flex-col gap-1.5 border-t-2 border-ink pt-4">
        {footnotes.map((f) => (
          <p key={f.code} className="max-w-[72ch] text-sm text-ink-2">
            {f.message}
          </p>
        ))}
        <Disclaimer />
      </div>
    </section>
  );
}
