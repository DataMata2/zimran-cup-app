import { Badge } from "@/components/kit/Badge";
import { cx } from "@/components/kit/cx";
import { longDate, money } from "@/lib/product/format";
import { calendarNote } from "@/lib/product/calendar";
import { installmentRow } from "@/lib/product/payNow";
import { CalendarButton } from "./CalendarButton";
import type { TaxResult } from "@/lib/tax";

const RETURN_DUE = "2027-04-15";

/** The four 2026 instalments, the April return, and the calendar file. */
export function Deadlines({ result, className }: { result: TaxResult; className?: string }) {
  const trueUp = result.aprilTrueUp;
  const nextQuarter = result.nextDeadline?.quarter ?? null;

  return (
    <section aria-labelledby="deadlines-title" className={cx("min-w-0", className)}>
      <h2 id="deadlines-title" className="font-display text-2xl leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[1.75rem]">
        Your 2026 deadlines
      </h2>
      <p className="mt-2 text-base text-ink-2">Federal estimated tax, Form 1040-ES.</p>

      <div className="mt-5 overflow-hidden rounded-lg border-3 border-ink bg-surface shadow-hard">
        <ol>
          {result.installments.map((i) => {
            const { amount, note } = installmentRow(result, i);
            const isNext = i.quarter === nextQuarter;
            return (
              <li
                key={i.quarter}
                aria-current={isNext ? "step" : undefined}
                className={cx(
                  "relative grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b-2 border-ink px-4 py-4 sm:grid-cols-[2.75rem_minmax(0,1fr)_7rem_7rem] sm:px-5",
                  i.status === "pastDue" ? "bg-hot-soft" : isNext && "bg-sun-soft",
                )}
              >
                {isNext && <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-ink" />}
                <span className="font-mono text-sm font-bold tracking-[0.04em] text-ink">Q{i.quarter}</span>
                <span className="min-w-0">
                  <span className="block text-base font-bold text-ink">{longDate(i.due)}</span>
                  <span className="block text-sm text-ink-2">{note}</span>
                </span>
                <span className="flex flex-col items-end gap-1.5 sm:contents">
                  <span className="text-right font-display text-lg leading-none font-extrabold text-ink tabular-nums">{money(amount)}</span>
                  <span className="sm:justify-self-end">
                    <Badge status={i.status} />
                  </span>
                </span>
              </li>
            );
          })}
          <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 bg-paper px-4 py-4 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:px-5">
            <span className="font-mono text-sm font-bold tracking-[0.04em] text-ink">Apr</span>
            <span className="min-w-0">
              <span className="block text-base font-bold text-ink">{longDate(RETURN_DUE)}, your 2026 return</span>
              <span className="block text-sm text-ink-2">
                {trueUp > 0.5
                  ? <>Estimated balance with your return: <span className="font-bold text-ink">{money(trueUp)}</span></>
                  : trueUp < -0.5
                    ? <>Estimated refund with your return: <span className="font-bold text-ink">{money(-trueUp)}</span></>
                    : "No federal balance expected with your return."}
              </span>
            </span>
          </li>
        </ol>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <CalendarButton result={result} />
        <p className="text-sm text-ink-2">{calendarNote(result)}</p>
      </div>
    </section>
  );
}
