import { Badge } from "@/components/kit/Badge";
import { buttonClasses } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { longDate, money } from "@/lib/product/format";
import { missedRemaining, payTarget, type PayTarget } from "@/lib/product/payNow";
import { icsHref } from "@/lib/product/icsParam";
import type { Installment, TaxInput, TaxResult } from "@/lib/tax";

const RETURN_DUE = "2027-04-15";

/**
 * What a row shows: the amount and a short line under the date. A past-due part is paid now, so the next
 * deadline's row shows only its own instalment and each missed row shows what is still unpaid on it.
 */
function rowContent(i: Installment, result: TaxResult, target: PayTarget | null): { amount: number; note: string } {
  const next = result.nextDeadline;
  if (next && next.quarter === i.quarter) {
    const own = target?.isNext ? target.amount : 0;
    return { amount: own, note: own > 0 ? "Pay by this date" : "Already covered" };
  }
  switch (i.status) {
    case "paid":
      return { amount: i.required, note: "Covered" };
    case "pastDue":
      return { amount: missedRemaining(result, i.quarter), note: "Missed, pay now" };
    default:
      return { amount: i.plannedPayment, note: i.plannedPayment > 0 ? "Planned" : "Nothing to pay" };
  }
}

/** The four 2026 instalments, the April return, and the calendar file. */
export function Deadlines({ result, input, className }: { result: TaxResult; input: TaxInput; className?: string }) {
  const trueUp = result.aprilTrueUp;
  const nextQuarter = result.nextDeadline?.quarter ?? null;
  const target = payTarget(result);

  return (
    <section aria-labelledby="deadlines-title" className={cx("min-w-0", className)}>
      <h2 id="deadlines-title" className="text-xl font-bold tracking-[-0.015em] text-ink">
        Your 2026 deadlines
      </h2>
      <p className="mt-1 text-sm text-ink-2">Federal estimated tax, Form 1040-ES.</p>

      <div className="mt-5 rounded-lg border border-line bg-surface">
        <ol>
          {result.installments.map((i) => {
            const { amount, note } = rowContent(i, result, target);
            const isNext = i.quarter === nextQuarter;
            return (
              <li
                key={i.quarter}
                aria-current={isNext ? "step" : undefined}
                className={cx(
                  "relative grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line px-4 py-3.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_6.5rem] sm:px-5",
                  isNext && "bg-accent-soft/40",
                )}
              >
                {isNext && <span aria-hidden className="absolute inset-y-0 left-0 w-1 rounded-r-sm bg-accent" />}
                <span className="text-sm font-semibold text-ink-3">Q{i.quarter}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{longDate(i.due)}</span>
                  <span className="block text-xs text-ink-2">{note}</span>
                </span>
                <span className="flex flex-col items-end gap-1 sm:contents">
                  <span className="text-right text-sm font-semibold text-ink">{money(amount)}</span>
                  <span className="sm:justify-self-end">
                    <Badge status={i.status} />
                  </span>
                </span>
              </li>
            );
          })}
          <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 px-4 py-3.5 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:px-5">
            <span className="text-sm font-semibold text-ink-3">Apr</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{longDate(RETURN_DUE)}, your 2026 return</span>
              <span className="block text-sm text-ink-2">
                {trueUp > 0.5
                  ? <>Estimated balance with your return: <span className="font-semibold text-ink">{money(trueUp)}</span></>
                  : trueUp < -0.5
                    ? <>Estimated refund with your return: <span className="font-semibold text-accent-ink">{money(-trueUp)}</span></>
                    : "No federal balance expected with your return."}
              </span>
            </span>
          </li>
        </ol>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <a
          href={icsHref(input)}
          download="penaltyproof-2026.ics"
          className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="12" height="11" rx="2" />
            <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
          </svg>
          Add all to calendar (.ics)
        </a>
        <p className="text-sm text-ink-3">Each remaining deadline with its amount, plus a reminder 3 days before.</p>
      </div>
    </section>
  );
}
