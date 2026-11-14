"use client";

import { Card } from "@/components/kit/Card";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { EXAMPLE_DESCRIPTION, EXAMPLE_NAME } from "@/lib/product/example";
import { longDate, moneyUp, pct } from "@/lib/product/format";
import { missedLabel, nextLabel, pastDue, payTarget } from "@/lib/product/payNow";
import { PaidMeter } from "@/components/plan/PaidMeter";
import { useExamplePlan } from "./useExamplePlan";

/** Placeholder block with the same footprint as the number it stands in for. */
function Blank({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block rounded-sm bg-sunken align-middle ${className}`} />;
}

/** The example persona's two numbers and meter, as the product shows them. */
export function PlanPreview() {
  const plan = useExamplePlan();
  const due = plan ? pastDue(plan.result) : null;
  const target = plan ? payTarget(plan.result) : null;

  return (
    <Card as="section" raised padding="none" aria-labelledby="preview-title" aria-busy={!plan} className="overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b-3 border-ink bg-sun px-5 py-3.5 sm:px-6">
        <h2 id="preview-title" className="shrink-0 font-mono text-xs font-bold tracking-[0.08em] text-ink uppercase">
          Example: {EXAMPLE_NAME}&rsquo;s plan
        </h2>
        <p className="min-w-0 text-xs text-ink">{EXAMPLE_DESCRIPTION}</p>
      </div>

      <div className="px-5 pt-5 pb-6 sm:px-6 sm:pt-6">
        {plan ? (
          due ? (
            <>
              <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-hot px-2.5 py-1 font-mono text-[11px] leading-none font-bold tracking-[0.08em] text-ink uppercase">
                {missedLabel(due.quarters)}
              </p>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-2xl font-extrabold tracking-[-0.03em] text-ink">Pay</span>
                <span className="font-display text-[2.75rem] leading-none font-extrabold tracking-[-0.035em] text-ink sm:text-[3.5rem]">
                  {moneyUp(due.amount)}
                </span>
                <span className="font-display text-2xl font-extrabold tracking-[-0.03em] text-ink">now</span>
              </p>
              {target && (
                <div className="mt-5 rounded-md border-2 border-ink bg-paper px-4 py-3">
                  <p className="text-sm font-semibold text-ink-2">{nextLabel(target.quarter)}</p>
                  <p className="mt-0.5 text-base text-ink-2">
                    <span className="font-semibold text-ink">{moneyUp(target.amount)}</span> by{" "}
                    <span className="font-semibold whitespace-nowrap text-ink">{longDate(target.due)}</span>
                  </p>
                </div>
              )}
            </>
          ) : target ? (
            <>
              <p className="text-sm font-semibold text-ink-2">{nextLabel(target.quarter)}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-[2.75rem] leading-none font-extrabold tracking-[-0.035em] text-ink sm:text-[3.5rem]">
                  {moneyUp(target.amount)}
                </span>
                <span className="text-base font-semibold text-ink-2">by {longDate(target.due)}</span>
              </p>
            </>
          ) : (
            <p className="font-display text-2xl font-extrabold tracking-[-0.03em] text-ink">Nothing more to pay for 2026</p>
          )
        ) : (
          <>
            <Blank className="h-4 w-36" />
            <p className="mt-2">
              <Blank className="h-11 w-44" />
            </p>
          </>
        )}

        <div className="mt-6 flex items-center justify-between gap-4 rounded-md border-2 border-ink bg-sun-soft px-4 py-3">
          <p className="text-sm font-medium text-ink">Set aside from every payment</p>
          <p className="font-display text-[2rem] leading-none font-extrabold tracking-[-0.02em] text-ink">
            {plan ? pct(plan.result.setAside.rate, 0) : <Blank className="h-7 w-14" />}
          </p>
        </div>

        <PaidMeter
          meter={plan?.meter ?? null}
          titleAs="p"
          label={`${EXAMPLE_NAME}'s payments to the IRS`}
          className="mt-6"
        />
      </div>

      <div className="border-t-2 border-ink bg-paper px-5 py-3 sm:px-6">
        <Disclaimer />
      </div>
    </Card>
  );
}
