import type { ReactNode } from "react";
import { buttonClasses } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { longDate, moneyPay, pct } from "@/lib/product/format";
import {
  aboutMoney,
  allPaidCopy,
  catchUpLine,
  latePaidPenalty,
  latePaidText,
  lumpAssumptionText,
  missedLabel,
  nextLabel,
  payNowPlan,
  payTarget,
  payTargetEnding,
  type PayNow,
} from "@/lib/product/payNow";
import { safeHarborCopy } from "@/lib/product/safeHarborCopy";
import { estimateAccruedPenalty, type TaxResult } from "@/lib/tax";

const DIRECT_PAY_URL = "https://www.irs.gov/payments/direct-pay";

/** The two numbers: what to pay by the next deadline, and the share of every payment to set aside. */
/** `lumpPaid` = profile.estimatedPaid, the quiz's undated "paid so far" (PP-QA-03: no "penalty-proof" while > 0). */
export function PlanHero({ result, lumpPaid = 0, className }: { result: TaxResult; lumpPaid?: number; className?: string }) {
  const target = payTarget(result);
  const penalty = estimateAccruedPenalty(result);
  const payNow = payNowPlan(result, penalty);
  // Penalty from quarters paid late; the headlines below must not claim "penalty-proof" while it is set.
  const latePenalty = latePaidPenalty(result, penalty);
  const allPaid = allPaidCopy(latePenalty, lumpPaid);
  const assumption = lumpPaid > 0 ? lumpAssumptionText(lumpPaid) : null;
  const { rate } = result.setAside;
  const catchUp = catchUpLine(result);

  return (
    <section aria-labelledby="pay-title" className={cx("flex min-w-0 flex-col gap-6 sm:gap-8", className)}>
      {payNow ? (
        <PayNowHeadline payNow={payNow} assumption={assumption} />
      ) : target ? (
        <div className="flow-root rounded-lg border-3 border-ink bg-surface px-5 py-6 shadow-hard sm:px-8 sm:py-8">
          <DateTile iso={target.due} className="float-right mb-2 ml-4" />
          <h1
            id="pay-title"
            className="font-display text-[2.25rem] leading-[1.05] font-bold tracking-[-0.03em] text-ink-2 sm:text-5xl sm:leading-[1.02] lg:text-[3.5rem]"
          >
            <AmountLabel>{nextLabel(target.quarter)}</AmountLabel>
            Pay <span className="font-extrabold text-ink tabular-nums">{moneyPay(target.amount)}</span> by{" "}
            <span className="font-extrabold whitespace-nowrap text-ink">{longDate(target.due)}</span>
            {payTargetEnding(latePenalty, lumpPaid)}
          </h1>
          {latePenalty !== null && <LatePaidNote amount={latePenalty} />}
          {assumption && <p className="mt-4 max-w-[52ch] text-sm text-ink-2">{assumption}</p>}
          {!target.isNext && result.nextDeadline && (
            <p className="mt-4 text-base text-ink-2">
              You&rsquo;ve already covered the {longDate(result.nextDeadline.due)} deadline.
            </p>
          )}
          <DirectPay />
        </div>
      ) : (
        <div className="rounded-lg border-3 border-ink bg-mint px-5 py-6 shadow-hard sm:px-8 sm:py-8">
          <span aria-hidden className="mb-4 flex size-12 items-center justify-center rounded-full border-3 border-ink bg-surface">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h1
            id="pay-title"
            className="max-w-[16ch] font-display text-[2.4rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-ink sm:text-5xl lg:text-[3.5rem]"
          >
            {allPaid.headline}
          </h1>
          <p className="mt-4 max-w-[52ch] text-base font-medium text-ink">{allPaid.body}</p>
          {latePenalty !== null && <LatePaidNote amount={latePenalty} onMint />}
          {assumption && <p className="mt-4 max-w-[52ch] text-sm text-ink">{assumption}</p>}
        </div>
      )}

      <div className="rounded-lg border-3 border-ink bg-surface px-5 py-6 shadow-hard sm:px-8 sm:py-7">
        {payNow?.then && <NextPayment then={payNow.then} />}
        <div className="flex items-center gap-4 rounded-md border-2 border-ink bg-sun px-4 py-3.5 sm:px-5">
          <span aria-hidden className="shrink-0 font-display text-[2rem] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums sm:text-[2.5rem]">
            {pct(rate, 0)}
          </span>
          <p className="text-base leading-snug font-bold text-ink sm:text-lg">
            Set aside <span className="font-extrabold">{pct(rate, 0)}</span> of every payment.
          </p>
        </div>
        {catchUp && <p className="mt-4 max-w-[60ch] text-base text-ink-2">{catchUp.text}</p>}
        <p className="mt-4 max-w-[60ch] text-sm text-ink-2">{safeHarborCopy(result).says}</p>
        <Disclaimer className="mt-3" />
      </div>
    </section>
  );
}

/** Penalty already built up from a quarter paid late, once nothing is past due. Calm: it no longer grows. */
function LatePaidNote({ amount, onMint = false }: { amount: number; onMint?: boolean }) {
  return (
    <p
      className={cx(
        "mt-5 flex max-w-[52ch] gap-2.5 rounded-md border-2 border-ink px-3.5 py-3 text-base",
        onMint ? "bg-surface text-ink" : "bg-sun-soft text-ink",
      )}
    >
      <span aria-hidden className="mt-[0.5em] size-2 shrink-0 rounded-full bg-ink" />
      <span>{latePaidText(amount)}</span>
    </p>
  );
}

function DirectPay({ onHot = false }: { onHot?: boolean }) {
  return (
    <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <a
        href={DIRECT_PAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses({ variant: onHot ? "dark" : "primary", size: "lg", className: "w-full px-4! text-center whitespace-normal! max-[374px]:gap-1.5 max-[374px]:px-3! max-[374px]:text-base sm:w-auto sm:px-6!" })}
      >
        Pay with IRS Direct Pay
        <svg aria-hidden viewBox="0 0 18 18" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h9v9M15 3 4 14" />
        </svg>
        <span className="sr-only"> (opens irs.gov in a new tab)</span>
      </a>
      <p
        className={cx(
          "text-sm",
          onHot ? "w-fit rounded-md border-2 border-ink bg-surface px-3 py-2 font-medium text-ink" : "text-ink-2",
        )}
      >
        Choose &ldquo;Estimated Tax&rdquo; and tax year 2026.
      </p>
    </div>
  );
}

/** The small line over a hero amount that says which payment it is. Part of the heading, read with a colon. */
function AmountLabel({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "red" }) {
  return (
    <span
      className={cx(
        "mb-4 font-mono text-xs leading-none font-bold tracking-[0.08em] uppercase",
        tone === "red"
          ? "flex w-fit items-center gap-2 rounded-full bg-ink px-3 py-2 text-white"
          : "block text-ink-3 sm:text-[13px]",
      )}
    >
      {tone === "red" && (
        <svg aria-hidden viewBox="0 0 14 14" className="size-3.5 shrink-0">
          <path d="M7 1 13 12H1z" fill="#FFD233" />
          <path d="M7 5v3.2" stroke="#141414" strokeWidth="2" strokeLinecap="round" />
          <circle cx="7" cy="10.2" r="1" fill="#141414" />
        </svg>
      )}
      {children}
      <span className="sr-only">: </span>
    </span>
  );
}

/**
 * Calendar-page tile for a due date ("JAN / 15 / 2027"). Decorative: the date is always in the text too.
 * The month band is hot only next to a missed payment; hot never marks a good state.
 */
function DateTile({ iso, alarm = false, className }: { iso: string; alarm?: boolean; className?: string }) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const m = [
    "",
    d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
    String(d.getUTCDate()),
    String(d.getUTCFullYear()),
  ];
  return (
    <span
      aria-hidden
      className={cx(
        "flex w-[4.75rem] shrink-0 flex-col items-center overflow-hidden rounded-md border-3 border-ink bg-surface text-center text-ink shadow-chip sm:w-[5.5rem]",
        className,
      )}
    >
      <span className={cx("block w-full border-b-2 border-ink py-1.5", alarm ? "bg-hot" : "bg-sun", "font-mono text-[11px] leading-none font-bold tracking-[0.1em] uppercase")}>
        {m[1]}
      </span>
      <span className="block px-2 pt-1.5 font-display text-[1.75rem] leading-none font-extrabold tabular-nums sm:text-[2rem]">{m[2]}</span>
      <span className="block pt-0.5 pb-1.5 font-mono text-[10px] leading-none font-bold tracking-[0.08em]">{m[3]}</span>
    </span>
  );
}

/** The next instalment after the past-due one, at the top of the set-aside card. */
function NextPayment({ then }: { then: NonNullable<PayNow["then"]> }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b-2 border-ink pb-6">
      <div className="min-w-0">
        <p className="font-mono text-xs font-bold tracking-[0.08em] text-ink-3 uppercase">{nextLabel(then.quarter)}</p>
        <p className="mt-2 text-lg leading-snug text-ink-2 sm:text-xl">
          <span className="block font-display text-[2.6rem] leading-none font-extrabold tracking-[-0.035em] text-ink tabular-nums sm:text-[3.25rem]">
            {moneyPay(then.amount)}
          </span>{" "}
          <span className="mt-1.5 block">
            by <span className="font-bold whitespace-nowrap text-ink">{longDate(then.due)}</span>
          </span>
        </p>
      </div>
      <DateTile iso={then.due} />
    </div>
  );
}

/** Past-due headline: the missed payment to make now, what each week of waiting costs, then the next one. */
function PayNowHeadline({ payNow, assumption }: { payNow: PayNow; assumption: string | null }) {
  const { amount, quarters, weeklyPenalty, penaltySoFar } = payNow;
  return (
    <div className="overflow-hidden rounded-lg border-3 border-ink bg-hot shadow-hard">
      <div className="px-5 pt-6 pb-6 sm:px-8 sm:pt-8">
        <h1
          id="pay-title"
          className="font-display text-[clamp(2.9rem,14.5vw,5.5rem)] leading-[0.95] font-extrabold tracking-[-0.05em] text-ink"
        >
          <AmountLabel tone="red">{missedLabel(quarters)}</AmountLabel>
          Pay{" "}
          <span className="inline-block rounded-[14px] border-3 border-ink bg-surface px-[0.1em] tabular-nums shadow-chip">
            {moneyPay(amount)}
          </span>{" "}
          now.
        </h1>
        <p className="mt-4 flex max-w-[52ch] gap-2.5 text-[17px] leading-snug font-medium text-ink sm:text-lg">
          <span aria-hidden className="mt-[0.5em] size-2 shrink-0 rounded-full bg-ink" />
          <span>
            {weeklyPenalty !== null
              ? `Every week it stays unpaid adds ${aboutMoney(weeklyPenalty)} in penalty.`
              : "Penalty grows daily until it\u2019s paid."}
          </span>
        </p>
        <DirectPay onHot />
      </div>
      <p className="border-t-3 border-ink bg-surface px-5 py-3 text-sm text-ink-2 sm:px-8">
        Penalty so far: {aboutMoney(penaltySoFar)} (estimate)
        {assumption && <span className="mt-0.5 block">{assumption}</span>}
      </p>
    </div>
  );
}
