"use client";

import { Badge } from "@/components/kit/Badge";
import { longDate, money } from "@/lib/product/format";
import type { Installment } from "@/lib/tax";
import { useExamplePlan } from "./useExamplePlan";

const QUARTERS = [1, 2, 3, 4] as const;

/** The example persona's four quarterly deadlines, with what to pay on each. */
export function DeadlinePreview() {
  const plan = useExamplePlan();

  return (
    <div className="rounded-lg border border-line bg-surface">
      <ol aria-label="Example: the four 2026 deadlines" aria-busy={!plan}>
        {QUARTERS.map((quarter, index) => {
          const i: Installment | null = plan?.result.installments[index] ?? null;
          // Past or paid quarters show what was required; open ones show what the plan says to pay.
          const amount = i ? (i.status === "upcoming" || i.status === "due" ? i.plannedPayment : i.required) : null;
          return (
            <li
              key={quarter}
              className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-x-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5"
            >
              <span className="text-sm font-semibold text-ink-3">Q{quarter}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{i ? longDate(i.due) : " "}</span>
                <span className="block text-sm text-ink-2">{amount !== null ? money(amount) : " "}</span>
              </span>
              {i ? <Badge status={i.status} /> : <span className="h-6 w-16 rounded-full bg-sunken" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
