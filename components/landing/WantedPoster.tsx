import { cx } from "@/components/kit/cx";

/** A grumpy penalty notice: our own illustration of the villain, on a hot panel. Decorative. */
function GrumpyEnvelope({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 250 150" aria-hidden className={className}>
      <g className="stroke-ink" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round">
        <rect x="40" y="26" width="170" height="108" rx="10" className="fill-paper" />
        <path d="M40 36 125 92l85-56" fill="none" />
        <path d="M88 64l22 8M162 64l-22 8" />
        <circle cx="100" cy="76" r="7" className="fill-ink" />
        <circle cx="150" cy="76" r="7" className="fill-ink" />
        <path d="M104 116q21-14 42 0" fill="none" />
        <rect x="150" y="10" width="78" height="34" rx="6" className="fill-sun" transform="rotate(8 189 27)" />
      </g>
      <text
        x="189"
        y="33"
        textAnchor="middle"
        transform="rotate(8 189 27)"
        className="fill-ink font-mono"
        fontWeight={700}
        fontSize={13}
      >
        PENALTY
      </text>
      <g className="fill-ink">
        <circle cx="22" cy="40" r="4" />
        <circle cx="230" cy="120" r="4" />
        <circle cx="16" cy="112" r="3" />
      </g>
    </svg>
  );
}

/** One stat tile: the number, then what it counts. Read in that order. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <p className="flex min-w-0 flex-col rounded-[10px] border-2 border-ink bg-paper px-2.5 py-2.5 sm:px-3">
      <span className="font-display text-[clamp(1.125rem,5.6vw,1.5rem)] leading-none font-extrabold tracking-[-0.02em] sm:text-[1.875rem]">
        {value}
      </span>{" "}
      <span className="mt-1.5 font-mono text-[10.5px] leading-[1.3] font-bold tracking-[0.06em] uppercase">{label}</span>
    </p>
  );
}

/** The estimated-tax penalty as a WANTED poster, with the IRS Data Book numbers the landing cites. */
export function WantedPoster({ className }: { className?: string }) {
  return (
    <aside
      aria-labelledby="wanted-title"
      className={cx(
        "relative w-full max-w-[320px] justify-self-center rounded-lg border-3 border-ink bg-surface p-4 shadow-hard",
        "sm:max-w-[460px] sm:p-[22px] lg:rotate-[1.5deg] lg:shadow-[10px_10px_0_0_var(--color-ink)]",
        className,
      )}
    >
      <div className="-mt-1 mb-4 flex items-baseline justify-between gap-3 border-b-3 border-ink pb-2.5">
        <p className="font-display text-[2rem] leading-none font-extrabold tracking-[0.02em] sm:text-[2.75rem]">
          WANTED
        </p>
        <p className="text-right font-mono text-[9.5px] leading-[1.2] font-bold tracking-[0.08em] uppercase sm:text-[11px]">
          for taking
          <br />
          {"freelancers' money"}
        </p>
      </div>

      <div className="grid h-[110px] place-items-center overflow-hidden rounded-[10px] border-3 border-ink bg-hot sm:h-[170px]">
        <GrumpyEnvelope className="h-[108px] w-[180px] sm:h-[150px] sm:w-[250px]" />
      </div>

      <h2
        id="wanted-title"
        className="mt-3 text-[1.25rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:mt-4 sm:text-[1.625rem]"
      >
        The <span className="whitespace-nowrap">estimated-tax</span> penalty
      </h2>
      <p className="mt-1 hidden font-mono text-[13px] leading-[1.4] font-medium tracking-[0.05em] text-ink-3 uppercase sm:block">
        Known aliases: Form 2210, &ldquo;underpayment&rdquo;
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Stat value="$12.06B" label="in estimated-tax penalties" />
        <Stat value="~$766" label="each" />
      </div>

      <p className="mt-3 font-mono text-[11px] leading-[1.3] font-medium tracking-[0.04em] text-ink-3">
        Source: IRS Data Book FY2025, Table 4-2
      </p>
    </aside>
  );
}
