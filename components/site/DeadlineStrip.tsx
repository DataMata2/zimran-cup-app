"use client";

import { DEADLINES } from "@/lib/tax/constants/federal2026";
import { dayNumber } from "@/lib/tax/dates";
import { longDate } from "@/lib/product/format";
import { useTodayIso } from "@/lib/product/useTodayIso";

/** The next quarterly deadline on or after today, and the days left until it. Null when none remains. */
function nextDeadline(today: string): { days: number; quarter: string; date: string } | null {
  const next = DEADLINES.find((d) => d.due >= today);
  if (!next) return null;
  return { days: dayNumber(next.due) - dayNumber(today), quarter: `Q${next.quarter}`, date: longDate(next.due) };
}

// The same height before and after the number arrives, so nothing below it moves.
const SHELL = "h-10 md:h-[72px]";

/**
 * Countdown to the next estimated-tax deadline, above the site header. Phone: one slim static line.
 * Desktop: a non-interactive ticker runs to the right of the sun block, clipped by its own container.
 */
export function DeadlineStrip() {
  const today = useTodayIso();

  // Server render and hydration: the shell only, no number.
  if (!today) return <div aria-hidden className={`${SHELL} border-b-3 border-ink bg-sun`} />;

  const next = nextDeadline(today);
  if (!next) return null;

  const today0 = next.days === 0;
  const digits = String(next.days).split("");
  // "Today: the Q4 deadline" on the day itself, "1 day" the day before, "N days" otherwise.
  const unit = next.days === 1 ? "day" : "days";
  const label = today0 ? `Today: the ${next.quarter} deadline` : `${unit} until the ${next.quarter} deadline`;
  const line = today0 ? label : `${next.days} ${label}`;
  // Four equal runs: the -50% loop shifts by exactly two of them, so it restarts seamlessly.
  const run = [0, 1, 2, 3].map((i) => (
    <span key={i} className="flex items-center gap-10 pr-10">
      <span>
        {line} <span className="text-sun">· {next.date} ·</span>
      </span>
      <span>
        The penalty doesn&rsquo;t take holidays <span className="text-sun">·</span>
      </span>
    </span>
  ));

  return (
    <div className={`${SHELL} flex border-b-3 border-ink bg-ink`}>
      <p className="relative z-10 flex h-full w-full shrink-0 items-center justify-center gap-2.5 bg-sun px-4 text-ink md:w-auto md:justify-start md:gap-3.5 md:border-r-3 md:border-ink md:px-6">
        {!today0 && (
          <>
            <span className="sr-only">{next.days} </span>
            <span aria-hidden className="flex gap-[3px]">
              {digits.map((d, i) => (
                <span
                  key={i}
                  className="grid h-[26px] w-5 place-items-center rounded-[4px] bg-ink font-display text-[18px] leading-none font-extrabold text-sun md:h-[52px] md:w-10 md:rounded-[7px] md:text-[38px]"
                >
                  {d}
                </span>
              ))}
            </span>
          </>
        )}
        <span className="font-mono text-[11px] leading-[1.15] font-bold tracking-[0.04em] whitespace-nowrap uppercase max-[379px]:text-[10px] md:text-xs md:tracking-[0.06em]">
          <span>{label}</span>
          <span className="max-[379px]:hidden md:hidden"> · </span>
          <span className="max-[379px]:block md:block">{next.date}</span>
        </span>
      </p>

      <div aria-hidden className="hidden min-w-0 flex-1 overflow-hidden md:flex md:items-center">
        <div className="flex w-max animate-[pp-marquee_40s_linear_infinite] font-mono text-sm leading-none font-bold tracking-[0.1em] whitespace-nowrap text-paper uppercase motion-reduce:animate-none">
          {run}
        </div>
      </div>
    </div>
  );
}
