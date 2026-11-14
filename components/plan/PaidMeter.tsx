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
        <Title id={titleId} className="text-lg font-bold tracking-[-0.01em] text-ink">
          Paid to the IRS
        </Title>
        {pct !== null && <span className="text-lg font-bold text-accent-ink">{pct}%</span>}
      </div>
      <p className="mt-0.5 text-sm text-ink-2">
        {meter ? keepDateTogether(meterSummary(meter)) : <span aria-hidden className="inline-block h-4 w-56 rounded-sm bg-sunken align-middle" />}
      </p>
      <ProgressBar
        className="mt-3"
        size="lg"
        animateIn
        value={meter ? meterFill(meter) : 0}
        ticks={ticks}
        tickLabels={labels}
        label={label}
        valueText={meter ? meterValueText(meter) : "Loading"}
      />

      <div className={cx("mt-4 border-t border-line pt-3", !meter && "invisible")}>
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <span aria-hidden className="hatch-accent size-2.5 shrink-0 rounded-[3px] ring-1 ring-accent-mid" />
          Set aside, not yet paid
          <span className="ml-auto font-semibold text-ink">{meter ? money(meter.setAside) : "$0"}</span>
        </p>
        {meter && meter.setAside >= 0.5 && (
          <p className="mt-1 pl-[1.125rem] text-xs text-ink-3">
            It counts against the penalty once you pay it to the IRS.
          </p>
        )}
        {showTarget && (
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] ring-1 ring-line-strong" />
            Safe-harbor amount for 2026
            <span className="ml-auto font-semibold text-ink">{money(meter.target)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** "Jan 15, 2027" never breaks across lines. */
function keepDateTogether(text: string): string {
  return text.replace(/([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/g, "$1\u00a0$2,\u00a0$3");
}
