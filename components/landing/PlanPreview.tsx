"use client";

import { Card } from "@/components/kit/Card";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { ProgressBar } from "@/components/kit/ProgressBar";
import { EXAMPLE_DESCRIPTION, EXAMPLE_NAME } from "@/lib/product/example";
import { dateList, longDate, money, pct } from "@/lib/product/format";
import { pastDuePart } from "@/lib/product/plan";
import { meterLabel, meterSegments } from "@/lib/product/meter";
import { useExamplePlan } from "./useExamplePlan";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

/** Placeholder block with the same footprint as the number it stands in for. */
function Blank({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block rounded-sm bg-sunken align-middle ${className}`} />;
}

/** The example persona's two numbers and meter, as the product shows them. */
export function PlanPreview() {
  const plan = useExamplePlan();
  const next = plan?.result.nextDeadline ?? null;
  const missed = plan ? pastDuePart(plan.result) : null;
  const segments = plan ? meterSegments(plan.meter) : null;

  return (
    <Card as="section" raised padding="none" aria-labelledby="preview-title" aria-busy={!plan} className="overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b border-line px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 sm:px-6">
        <h2 id="preview-title" className="shrink-0 text-sm font-semibold text-ink">
          Example: {EXAMPLE_NAME}&rsquo;s plan
        </h2>
        <p className="min-w-0 text-xs text-ink-3 sm:truncate">{EXAMPLE_DESCRIPTION}</p>
      </div>

      <div className="px-5 pt-5 pb-6 sm:px-6 sm:pt-6">
        <p className="text-sm text-ink-2">To stay penalty-proof, pay</p>
        {plan ? (
          next && next.amountDue > 0 ? (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[2.75rem] leading-none font-bold tracking-[-0.03em] text-ink sm:text-[3.25rem]">
                {money(next.amountDue)}
              </span>
              <span className="text-base font-semibold text-ink-2">by {longDate(next.due)}</span>
            </p>
          ) : (
            <p className="mt-1 text-2xl font-bold text-accent">Nothing more for 2026</p>
          )
        ) : (
          <p className="mt-1">
            <Blank className="h-11 w-44" />
          </p>
        )}
        {missed && (
          <p className="mt-3 inline-flex rounded-sm bg-amber-soft px-2.5 py-1 text-sm font-medium text-amber">
            Includes {money(missed.amount)} missed on {dateList(missed.dues)}
          </p>
        )}

        <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-line pt-5">
          <p className="text-sm text-ink-2">Set aside from every payment</p>
          <p className="text-2xl font-bold tracking-[-0.02em] text-ink">
            {plan ? pct(plan.result.setAside.rate, 0) : <Blank className="h-7 w-14" />}
          </p>
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <p className="text-sm font-semibold text-accent-ink">
            {plan ? meterLabel(plan.meter) : <Blank className="h-4 w-40" />}
          </p>
          <ProgressBar
            className="mt-3"
            size="lg"
            animateIn
            value={segments?.paidPct ?? 0}
            secondary={segments?.setAsidePct ?? 0}
            tickLabels={QUARTERS}
            label={`${EXAMPLE_NAME}'s penalty-proof progress`}
            valueText={plan ? meterLabel(plan.meter) : "Loading"}
          />
          <ul className="mt-4 flex flex-col gap-1.5 text-sm text-ink-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[3px] bg-accent" />
              Paid to IRS <span className="font-semibold text-ink">{plan ? money(plan.meter.paid) : "…"}</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="hatch-accent size-2.5 rounded-[3px] ring-1 ring-accent-mid" />
              Set aside <span className="font-semibold text-ink">{plan ? money(plan.meter.setAside) : "…"}</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[3px] ring-1 ring-line-strong" />
              Safe-harbor target <span className="font-semibold text-ink">{plan ? money(plan.meter.target) : "…"}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line bg-paper/60 px-5 py-3 sm:px-6">
        <Disclaimer />
      </div>
    </Card>
  );
}
