import type { ReactNode } from "react";
import { buttonClasses } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { longDate, money, pct } from "@/lib/product/format";
import {
  aboutMoney,
  allPaidCopy,
  catchUpLine,
  latePaidPenalty,
  latePaidText,
  missedLabel,
  nextLabel,
  payNowPlan,
  payTarget,
  payTargetPurpose,
  type PayNow,
} from "@/lib/product/payNow";
import { estimateAccruedPenalty, type TaxResult } from "@/lib/tax";

const DIRECT_PAY_URL = "https://www.irs.gov/payments/direct-pay";

/** The two numbers: what to pay by the next deadline, and the share of every payment to set aside. */
export function PlanHero({ result, className }: { result: TaxResult; className?: string }) {
  const target = payTarget(result);
  const penalty = estimateAccruedPenalty(result);
  const payNow = payNowPlan(result, penalty);
  // Penalty from quarters paid late; the headlines below must not claim "penalty-proof" while it is set.
  const latePenalty = latePaidPenalty(result, penalty);
  const allPaid = allPaidCopy(latePenalty);
  const { rate } = result.setAside;
  const catchUp = catchUpLine(result);

  return (
    <section aria-labelledby="pay-title" className={cx("min-w-0", className)}>
      {payNow ? (
        <PayNowHeadline payNow={payNow} />
      ) : target ? (
        <>
          <h1
            id="pay-title"
            className="max-w-[17ch] text-[2.4rem] leading-[1.08] font-medium tracking-[-0.03em] text-ink-2 sm:text-5xl sm:leading-[1.05] lg:text-[3.5rem]"
          >
            <AmountLabel>{nextLabel(target.quarter)}</AmountLabel>
            Pay <span className="font-bold text-ink">{money(target.amount)}</span> by{" "}
            <span className="font-bold whitespace-nowrap text-ink">{longDate(target.due)}</span>{" "}
            {payTargetPurpose(latePenalty)}
          </h1>
          {latePenalty !== null && <LatePaidNote amount={latePenalty} />}
          {!target.isNext && result.nextDeadline && (
            <p className="mt-4 text-base text-ink-2">
              You&rsquo;ve already covered the {longDate(result.nextDeadline.due)} deadline.
            </p>
          )}
          <DirectPay />
        </>
      ) : (
        <>
          <h1
            id="pay-title"
            className="max-w-[16ch] text-[2.4rem] leading-[1.08] font-bold tracking-[-0.03em] text-accent sm:text-5xl lg:text-[3.5rem]"
          >
            {allPaid.headline}
          </h1>
          <p className="mt-4 max-w-[52ch] text-base text-ink-2">{allPaid.body}</p>
          {latePenalty !== null && <LatePaidNote amount={latePenalty} />}
        </>
      )}

      <div className="mt-10 border-t border-line pt-8">
        <p className="max-w-[22ch] text-2xl leading-tight font-medium tracking-[-0.02em] text-ink-2 sm:text-3xl">
          Set aside <span className="font-bold text-ink">{pct(rate, 0)}</span> of every payment.
        </p>
        {catchUp && <p className="mt-3 max-w-[60ch] text-base text-ink-2">{catchUp.text}</p>}
        <p className="mt-5 max-w-[60ch] text-sm text-ink-2">{result.safeHarbor.reason}</p>
        <Disclaimer className="mt-3" />
      </div>
    </section>
  );
}

/** Penalty already built up from a quarter paid late, once nothing is past due. Calm: it no longer grows. */
function LatePaidNote({ amount }: { amount: number }) {
  return (
    <p className="mt-4 flex max-w-[52ch] gap-2.5 text-base text-ink-2">
      <span aria-hidden className="mt-[0.55em] size-2 shrink-0 rounded-full bg-amber-mid" />
      <span>{latePaidText(amount)}</span>
    </p>
  );
}

function DirectPay() {
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <a
        href={DIRECT_PAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}
      >
        Pay with IRS Direct Pay
        <span className="sr-only"> (opens irs.gov in a new tab)</span>
      </a>
      <p className="text-sm text-ink-3">Choose &ldquo;Estimated Tax&rdquo; and tax year 2026.</p>
    </div>
  );
}

/** The small line over a hero amount that says which payment it is. Part of the heading, read with a colon. */
function AmountLabel({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "red" }) {
  return (
    <span
      className={cx(
        "mb-3 block text-base leading-snug font-semibold tracking-normal sm:text-lg",
        tone === "red" ? "text-red" : "text-ink-2",
      )}
    >
      {children}
      <span className="sr-only">: </span>
    </span>
  );
}

/** Past-due headline: the missed payment to make now, what each week of waiting costs, then the next one. */
function PayNowHeadline({ payNow }: { payNow: PayNow }) {
  const { amount, quarters, weeklyPenalty, then, penaltySoFar } = payNow;
  return (
    <>
      <h1
        id="pay-title"
        className="max-w-[17ch] text-[2.4rem] leading-[1.08] font-medium tracking-[-0.03em] text-ink-2 sm:text-5xl sm:leading-[1.05] lg:text-[3.5rem]"
      >
        <AmountLabel tone="red">{missedLabel(quarters)}</AmountLabel>
        Pay <span className="font-bold text-ink">{money(amount)}</span> now.
      </h1>
      <p className="mt-4 flex max-w-[52ch] gap-2.5 text-base font-medium text-red">
        <span aria-hidden className="mt-[0.55em] size-2 shrink-0 rounded-full bg-red" />
        <span>
          {weeklyPenalty !== null
            ? `Every week it stays unpaid adds ${aboutMoney(weeklyPenalty)} in penalty.`
            : "Penalty grows daily until it\u2019s paid."}
        </span>
      </p>
      {then && (
        <div className="mt-7 border-l-2 border-line-strong pl-4">
          <p className="text-sm font-semibold text-ink-2">{nextLabel(then.quarter)}</p>
          <p className="mt-1 text-xl leading-snug tracking-[-0.01em] text-ink-2 sm:text-2xl">
            <span className="font-bold text-ink">{money(then.amount)}</span> by{" "}
            <span className="font-bold whitespace-nowrap text-ink">{longDate(then.due)}</span>
          </p>
        </div>
      )}
      <DirectPay />
      <p className="mt-4 text-xs text-ink-3">
        Penalty so far: {aboutMoney(penaltySoFar)} (estimate)
        <span className="mt-0.5 block">Assumes the amount you&rsquo;d already paid was paid on time.</span>
      </p>
    </>
  );
}
