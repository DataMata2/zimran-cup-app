import { cx } from "@/components/kit/cx";
import { ProgressBar } from "@/components/kit/ProgressBar";
import { money } from "@/lib/product/format";
import { meterFill, meterPctLabel, meterSummary, meterTicks, meterValueText, type PenaltyMeter } from "@/lib/product/meter";

interface Props {
  /** Null while the numbers load: the layout stays, the figures are blank. */
  meter: PenaltyMeter | null;
  /** Heading level and id, so the card around it can label itself with it. */
  titleAs?: "h2" | "h3" | "p";
  titleId?: string;
  label?: string;
  className?: string;
}

/**
 * Paid to the IRS against the legal minimum due so far. Only IRS payments fill the bar; money set aside
 * sits on its own line, because it doesn't protect against the penalty until it is paid.
 */
export function PaidMeter({ meter, titleAs: Title = "h2", titleId, label = "Paid to the IRS", className }: Props) {
  const pct = meter ? meterPctLabel(meter) : null;
  const { ticks, labels } = meter ? meterTicks(meter) : { ticks: [], labels: [] };
  const showTarget = meter !== null && meter.pct !== null && Math.abs(meter.target - meter.required) >= 0.5;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <Title id={titleId} className="font-display text-xl font-extrabold tracking-[-0.03em] text-ink sm:text-2xl">
          Paid to the IRS
        </Title>
        {pct !== null && (
          <span className="font-display text-[2.25rem] leading-none font-extrabold tracking-[-0.035em] text-ink tabular-nums sm:text-[2.75rem]">
            {pct}%
          </span>
        )}
      </div>
      <p className="mt-1.5 text-base text-ink-2">
        {meter ? keepDateTogether(meterSummary(meter)) : <span aria-hidden className="inline-block h-4 w-56 rounded-sm bg-sunken align-middle" />}
      </p>
      <ProgressBar
        className="mt-4"
        size="lg"
        animateIn
        value={meter ? meterFill(meter) : 0}
        ticks={ticks}
        label={label}
        valueText={meter ? meterValueText(meter) : "Loading"}
      />
      {labels.length > 0 && (
        <div
          aria-hidden
          className="mt-2 grid font-mono text-[11px] leading-4 font-bold tracking-[0.06em] text-ink uppercase"
          style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}
        >
          {labels.map((l) => (
            <span key={l} className="text-center">
              {l}
            </span>
          ))}
        </div>
      )}
      <div aria-hidden className={cx("mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-medium text-ink-2", !meter && "invisible")}>
        <span className="flex items-center gap-2">
          <span className="size-3.5 shrink-0 rounded-[4px] border-2 border-ink bg-mint" />
          Paid to the IRS
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3.5 shrink-0 rounded-[4px] border-2 border-ink bg-surface" />
          Still to go
        </span>
      </div>

      <div className={cx("mt-5 flex overflow-hidden rounded-md border-2 border-ink bg-surface", !meter && "invisible")}>
        <span aria-hidden className="hatch-accent w-3.5 shrink-0 border-r-2 border-ink" />
        <div className="min-w-0 flex-1 px-4 py-3">
          <p className="flex items-baseline gap-3 text-sm font-medium text-ink-2">
            Set aside, not yet paid
            <span className="ml-auto font-display text-xl font-extrabold tracking-[-0.02em] text-ink tabular-nums">
              {meter ? money(meter.setAside) : "$0"}
            </span>
          </p>
          {meter && meter.setAside >= 0.5 && (
            <p className="mt-1 text-sm text-ink-2">It counts against the penalty once you pay it to the IRS.</p>
          )}
        </div>
      </div>
      {showTarget && (
        <p className="mt-3 flex items-baseline gap-3 px-1 text-sm text-ink-2">
          Safe-harbor amount for 2026
          <span className="ml-auto font-bold text-ink tabular-nums">{money(meter.target)}</span>
        </p>
      )}
    </div>
  );
}

/** "Jan 15, 2027" never breaks across lines. */
function keepDateTogether(text: string): string {
  return text.replace(/([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/g, "$1\u00a0$2,\u00a0$3");
}
