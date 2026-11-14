"use client";

import { useMemo } from "react";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { ANNUALIZED_METHOD_LABEL, computeAnnualizedPlan, type AnnualizedHeadline, type AnnualizedRow } from "@/lib/product/annualizedPlan";
import { longDate, money } from "@/lib/product/format";
import type { LogEntry, Profile } from "@/lib/product/types";
import { TaxInputError } from "@/lib/tax";
import { ProCheck, proCardClasses, ProSticker } from "./LockIcon";
import type { PaywallReason } from "./Paywall";

const NOTE = "Uses IRS Form 2210 Schedule AI. You attach that form to your return to use it.";

/**
 * "Paid unevenly? Your annualized plan" (Pro): each quarter's required instalment under the regular schedule
 * and under Schedule AI, from the engine, with one sentence on what that means by the next deadline.
 * Free users see what the card does and a button to the paywall.
 */
export function AnnualizedCard({
  profile,
  log,
  asOf,
  pro,
  onNeedPro,
  className,
}: {
  profile: Profile;
  log: readonly LogEntry[];
  asOf: string;
  pro: boolean;
  onNeedPro: (reason: PaywallReason) => void;
  className?: string;
}) {
  const plan = useMemo(() => {
    if (!pro) return null;
    try {
      return computeAnnualizedPlan(profile, log, asOf);
    } catch (err) {
      if (err instanceof TaxInputError) return null;
      throw err;
    }
  }, [pro, profile, log, asOf]);

  // Pro, but the engine rejected the input: the rest of the page already says so, so show nothing here.
  if (pro && !plan) return null;

  return (
    <section aria-labelledby="annualized-title" className={cx(proCardClasses(!pro), className)}>
      <div className="flex items-center gap-2">
        <h2 id="annualized-title" className="font-display text-2xl leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[1.75rem]">
          Paid unevenly? Your annualized plan
        </h2>
        {!pro && <ProSticker />}
      </div>
      <p className="mt-2 max-w-[62ch] text-base text-ink-2">
        {pro ? ANNUALIZED_METHOD_LABEL : "The IRS lets each quarter\u2019s payment follow the income you had actually received by then, instead of four equal parts."}
      </p>

      {plan ? (
        <div className="mt-5 rounded-md border-2 border-ink bg-surface">
          <div className="border-b-2 border-ink px-4 py-4 sm:px-5">
            <Headline headline={plan.headline} />
          </div>
          {plan.headline.kind !== "noneRequired" && <Comparison rows={plan.rows} />}
          {plan.headline.kind !== "noneRequired" && plan.reconciliation && (
            <p className="px-4 pb-4 text-sm text-ink-2 sm:px-5">{plan.reconciliation}</p>
          )}
          <div className="flex flex-col gap-1.5 border-t-2 border-ink px-4 py-3.5 sm:px-5">
            <p className="text-sm text-ink-2">{NOTE}</p>
            <Disclaimer />
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <ul className="flex flex-col gap-2.5 text-base text-ink">
            <li className="flex gap-2.5"><ProCheck /><span>Each quarter&rsquo;s required payment under both methods, side by side.</span></li>
            <li className="flex gap-2.5"><ProCheck /><span>How much less you&rsquo;d owe by your next deadline if most of your income came late.</span></li>
            <li className="flex gap-2.5"><ProCheck /><span>Built from the dates of the payments in your log.</span></li>
          </ul>
          <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={() => onNeedPro("annualized")}>
            Unlock with Pro
          </Button>
        </div>
      )}
    </section>
  );
}

function Headline({ headline }: { headline: AnnualizedHeadline }) {
  switch (headline.kind) {
    case "lessByNext":
      return (
        <p className="text-lg font-bold tracking-[-0.01em] text-accent-ink">
          With the annualized method you&rsquo;d owe {money(headline.amount)} less by {longDate(headline.due)}.
        </p>
      );
    case "lessEarlier":
      return (
        <>
          <p className="text-lg font-bold tracking-[-0.01em] text-accent-ink">
            With the annualized method you&rsquo;d have owed {money(headline.amount)} less by {longDate(headline.due)}.
          </p>
          <p className="mt-1 text-sm text-ink-2">
            That lowers any penalty for paying late.
            {headline.nextDue ? ` By ${longDate(headline.nextDue)} both methods ask for the same total.` : ""}
          </p>
        </>
      );
    case "regularBest":
      return (
        <>
          <p className="text-lg font-bold tracking-[-0.01em] text-ink">
            On these figures, the regular schedule already costs no more.
          </p>
          <p className="mt-1 text-sm text-ink-2">The annualized method helps when most income lands late in the year.</p>
        </>
      );
    case "noneRequired":
      return (
        <p className="text-lg font-bold tracking-[-0.01em] text-ink">
          You don&rsquo;t need estimated payments for 2026, so there is nothing to annualize.
        </p>
      );
  }
}

/** The four quarters, regular and annualized, each with a pair of bars on one scale. */
function Comparison({ rows }: { rows: AnnualizedRow[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.regular, r.annualized]));
  const width = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

  return (
    <div className="px-4 pt-3 pb-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 pb-2 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-4 rounded-[3px] border-2 border-ink bg-ink-3" />
          Regular
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-4 rounded-[3px] border-2 border-ink bg-mint" />
          Annualized
        </span>
      </div>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Required instalments, regular and annualized</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Quarter</th>
            <th scope="col">Regular</th>
            <th scope="col">Annualized</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.quarter}
              aria-current={r.next ? "step" : undefined}
              className={cx("border-t-2 border-ink/25 first:border-t-0", r.next && "bg-sun-soft")}
            >
              <th scope="row" className="w-[6.5rem] py-3 pr-3 align-top font-normal sm:w-[9rem]">
                <span className="block text-sm font-semibold text-ink">Q{r.quarter}</span>
                <span className="block text-xs text-ink-2">
                  {longDate(r.due)}
                  {r.next ? <span className="block font-semibold text-accent-ink">Next deadline</span> : r.past ? <span className="block">Passed</span> : null}
                </span>
              </th>
              <td colSpan={2} className="py-3 align-top">
                <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] items-center gap-x-3 gap-y-1.5">
                  <span aria-hidden className="h-3.5 overflow-hidden rounded-[4px] border-2 border-ink bg-surface">
                    <span className="block h-full bg-ink-3" style={{ width: width(r.regular) }} />
                  </span>
                  <span className="text-right text-sm text-ink-2">
                    <span className="sr-only">Regular </span>
                    {money(r.regular)}
                  </span>
                  <span aria-hidden className="h-3.5 overflow-hidden rounded-[4px] border-2 border-ink bg-surface">
                    <span className="block h-full bg-mint" style={{ width: width(r.annualized) }} />
                  </span>
                  <span className="text-right text-sm font-semibold text-ink">
                    <span className="sr-only">Annualized </span>
                    {r.showAnnualized ? money(r.annualized) : <><span aria-hidden>&ndash;</span><span className="sr-only">lower, see the note below</span></>}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
