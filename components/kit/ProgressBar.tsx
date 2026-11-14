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
  /** Accessible name, e.g. "Penalty-proof progress". */
  label: string;
  /** Spoken value, e.g. "Q4: 63% penalty-proof". Defaults to the covered percent. */
  valueText?: string;
  size?: "md" | "lg";
  /** Grow in from the left once, on first paint. */
  animateIn?: boolean;
  className?: string;
}

const DEFAULT_TICKS = [25, 50, 75, 100] as const;

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

/**
 * Two-segment progress bar with tick marks. Segment widths transition, so the bar animates whenever a
 * value changes.
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
          "relative w-full overflow-hidden rounded-full bg-sunken ring-1 ring-inset ring-line",
          size === "lg" ? "h-4" : "h-2.5",
        )}
      >
        <div className={cx("flex h-full w-full origin-left", animateIn && "animate-[pp-grow_900ms_var(--ease-out-soft)_150ms_both]")}>
          <div
            className="h-full bg-accent transition-[width] duration-700 ease-out-soft"
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
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-paper/90"
              style={{ left: `${t}%` }}
            />
          ))}
      </div>
      {tickLabels && tickLabels.length > 0 && (
        <div aria-hidden className="relative mt-1.5 h-4 text-xs leading-4 text-ink-3">
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
