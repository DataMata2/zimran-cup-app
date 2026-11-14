"use client";

import { Badge } from "@/components/kit/Badge";
import { longDate } from "@/lib/product/format";
import { installmentRow } from "@/lib/product/payNow";
import type { Installment } from "@/lib/tax";
import { useExamplePlan } from "./useExamplePlan";

const QUARTERS = [1, 2, 3, 4] as const;

/** The example persona's four quarterly deadlines, with what to pay on each. */
export function DeadlinePreview() {
  const plan = useExamplePlan();

  return (
    <div className="overflow-hidden rounded-lg border-3 border-ink bg-surface shadow-hard">
      <ol aria-label="Example: the four 2026 deadlines" aria-busy={!plan}>
        {QUARTERS.map((quarter, index) => {
          const i: Installment | null = plan?.result.installments[index] ?? null;
          // The same amounts as the /plan deadlines: missed rows show what is unpaid, the next one its own part.
          const amount = i && plan ? installmentRow(plan.result, i).amountText : null;
          return (
            <li
              key={quarter}
              className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-x-3 border-b-2 border-ink px-4 py-3.5 last:border-b-0 sm:px-5"
            >
              <span className="font-display text-xl leading-none font-extrabold tracking-[-0.02em] text-ink">Q{quarter}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{i ? longDate(i.due) : " "}</span>
                <span className="block text-sm text-ink-2">{amount !== null ? amount : " "}</span>
              </span>
              {i ? <Badge status={i.status} /> : <span className="h-[23px] w-20 rounded-full border-2 border-ink/20 bg-sunken" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
