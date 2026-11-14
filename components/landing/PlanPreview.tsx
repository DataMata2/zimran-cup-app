"use client";

import { Card } from "@/components/kit/Card";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { EXAMPLE_DESCRIPTION, EXAMPLE_NAME } from "@/lib/product/example";
import { longDate, money, pct } from "@/lib/product/format";
import { pastDue, pastDueSentence, payTarget } from "@/lib/product/payNow";
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
      <div className="flex flex-col gap-0.5 border-b border-line px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 sm:px-6">
        <h2 id="preview-title" className="shrink-0 text-sm font-semibold text-ink">
          Example: {EXAMPLE_NAME}&rsquo;s plan
        </h2>
        <p className="min-w-0 text-xs text-ink-3 sm:truncate">{EXAMPLE_DESCRIPTION}</p>
      </div>

      <div className="px-5 pt-5 pb-6 sm:px-6 sm:pt-6">
        <p className="text-sm text-ink-2">To stay penalty-proof, pay</p>
        {plan ? (
          due ? (
            <>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="text-[2.75rem] leading-none font-bold tracking-[-0.03em] text-ink sm:text-[3.25rem]">
                  {money(due.amount)}
                </span>
                <span className="text-base font-semibold text-ink-2">now</span>
              </p>
              {target && (
                <p className="mt-2 text-base text-ink-2">
                  then <span className="font-semibold text-ink">{money(target.amount)}</span> by{" "}
                  <span className="font-semibold whitespace-nowrap text-ink">{longDate(target.due)}</span>
                </p>
              )}
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-red">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-red" />
                {pastDueSentence(due.quarters)}
              </p>
            </>
          ) : target ? (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[2.75rem] leading-none font-bold tracking-[-0.03em] text-ink sm:text-[3.25rem]">
                {money(target.amount)}
              </span>
              <span className="text-base font-semibold text-ink-2">by {longDate(target.due)}</span>
            </p>
          ) : (
            <p className="mt-1 text-2xl font-bold text-accent">Nothing more for 2026</p>
          )
        ) : (
          <p className="mt-1">
            <Blank className="h-11 w-44" />
          </p>
        )}

        <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-line pt-5">
          <p className="text-sm text-ink-2">Set aside from every payment</p>
          <p className="text-2xl font-bold tracking-[-0.02em] text-ink">
            {plan ? pct(plan.result.setAside.rate, 0) : <Blank className="h-7 w-14" />}
          </p>
        </div>

        <PaidMeter
          meter={plan?.meter ?? null}
          titleAs="p"
          label={`${EXAMPLE_NAME}'s payments to the IRS`}
          className="mt-5 border-t border-line pt-5"
        />
      </div>

      <div className="border-t border-line bg-paper/60 px-5 py-3 sm:px-6">
        <Disclaimer />
      </div>
    </Card>
  );
}
