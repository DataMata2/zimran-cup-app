import { cx } from "./cx";

export interface ProgressBarProps {
  /** Solid segment (e.g. paid to the IRS), percent of the bar, 0..100. */
  value: number;
  /** Hatched segment right after it (e.g. set aside), percent of the bar. Clamped so both fit in 100. */
  secondary?: number;
  /** Tick marks, in percent. Default: the four quarters at 25 / 50 / 75 / 100. */
  ticks?: readonly number[];
  /** Optional labels under the ticks, same order (e.g. ["Q1", "Q2", "Q3", "Q4"]). */
  tickLabels?: readonly string[];
  /** Accessible name, e.g. "Paid to the IRS". */
  label: string;
  /** Spoken value, e.g. "Paid to the IRS: $3,700 of the $7,400 minimum due by Jan 15, 2027 (50%)". Defaults to the percent. */
  valueText?: string;
  size?: "md" | "lg";
  /** Grow in from the left once, on first paint. */
  animateIn?: boolean;
  className?: string;
}

const DEFAULT_TICKS = [25, 50, 75, 100] as const;

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

/**
 * Two-segment progress bar drawn as a chunky segmented track: 3px ink frame, ticks as ink cell dividers,
 * the value in solid mint, the secondary segment hatched (set aside, not yet paid). Segment widths
 * transition, so the bar animates whenever a value changes.
 */
export function ProgressBar({
  value,
  secondary = 0,
  ticks = DEFAULT_TICKS,
  tickLabels,
  label,
  valueText,
  size = "md",
  animateIn = false,
  className,
}: ProgressBarProps) {
  const solid = clamp(value);
  const hatched = Math.min(100 - solid, clamp(secondary));
  const total = Math.round(solid + hatched);

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={total}
        aria-valuetext={valueText ?? `${total}%`}
        className={cx(
          "relative w-full overflow-hidden rounded-md border-3 border-ink bg-surface",
          size === "lg" ? "h-9" : "h-6",
        )}
      >
        <div className={cx("flex h-full w-full origin-left", animateIn && "animate-[pp-grow_900ms_var(--ease-out-soft)_150ms_both]")}>
          <div
            className="h-full bg-mint transition-[width] duration-700 ease-out-soft"
            style={{ width: `${solid}%` }}
          />
          <div
            className="hatch-accent h-full transition-[width] duration-700 ease-out-soft"
            style={{ width: `${hatched}%` }}
          />
        </div>
        {ticks
          .filter((t) => t > 0 && t < 100)
          .map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-ink"
              style={{ left: `${t}%` }}
            />
          ))}
      </div>
      {tickLabels && tickLabels.length > 0 && (
        <div aria-hidden className="relative mt-2 h-4 font-mono text-[11px] leading-4 font-bold tracking-[0.04em] text-ink uppercase">
          {ticks.map((t, i) => (
            <span
              key={t}
              className={cx("absolute top-0", t >= 100 ? "-translate-x-full" : "-translate-x-1/2")}
              style={{ left: `${clamp(t)}%` }}
            >
              {tickLabels[i]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
