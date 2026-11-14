import { cx } from "@/components/kit/cx";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { money, pct } from "@/lib/product/format";
import { planNotes } from "@/lib/product/plan";
import { stateName } from "@/lib/product/states";
import type { StateCode, TaxResult } from "@/lib/tax";

/** Where the set-aside rate comes from: the year's tax by kind, the total and the effective rate. */
export function Breakdown({ result, state, className }: { result: TaxResult; state: StateCode; className?: string }) {
  const { tax, income, rates } = result;
  const { notes, footnotes } = planNotes(result.flags);
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
      <h2 id="breakdown-title" className="text-xl font-bold tracking-[-0.015em] text-ink">
        Your 2026 tax, estimated
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        On {money(income.net1099Annual)} of freelance profit for the year{income.projected ? " (projected from what you've been paid so far)" : ""}.
      </p>

      <dl className="mt-5 rounded-lg border border-line bg-surface px-4 sm:px-5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-sm">
            <dt className="text-ink-2">{r.label}</dt>
            <dd className="font-semibold text-ink">{r.value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-b border-line py-3.5">
          <dt className="text-base font-semibold text-ink">Total</dt>
          <dd className="text-base font-bold text-ink">{money(tax.total)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3.5 text-sm">
          <dt className="text-ink-2">Effective rate on freelance profit</dt>
          <dd className="font-semibold text-ink">{pct(rates.effectiveOnFreelance)}</dd>
        </div>
      </dl>

      {notes.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {notes.map((f) => (
            <li key={f.code} className="flex gap-2.5 text-sm text-ink-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-line-strong" />
              <span className="max-w-[68ch]">{f.message}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-col gap-1.5 border-t border-line pt-4">
        {footnotes.map((f) => (
          <p key={f.code} className="max-w-[72ch] text-xs text-ink-3">
            {f.message}
          </p>
        ))}
        <Disclaimer />
      </div>
    </section>
  );
}
