import { buttonClasses } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { longDate, money, pct } from "@/lib/product/format";
import { aboutMoney, payNowPlan, type PayNow } from "@/lib/product/payNow";
import { payTarget } from "@/lib/product/plan";
import { estimateAccruedPenalty, type TaxResult } from "@/lib/tax";

const DIRECT_PAY_URL = "https://www.irs.gov/payments/direct-pay";

/** The two numbers: what to pay by the next deadline, and the share of every payment to set aside. */
export function PlanHero({ result, className }: { result: TaxResult; className?: string }) {
  const target = payTarget(result);
  const payNow = payNowPlan(result, estimateAccruedPenalty(result));
  const { rate, catchUpRate } = result.setAside;
  const catchUp = catchUpRate > rate + 0.0005;

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
            Pay <span className="font-bold text-ink">{money(target.amount)}</span> by{" "}
            <span className="font-bold whitespace-nowrap text-ink">{longDate(target.due)}</span> to stay
            penalty-proof.
          </h1>
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
            You&rsquo;re penalty-proof for 2026.
          </h1>
          <p className="mt-4 max-w-[52ch] text-base text-ink-2">
            What you&rsquo;ve paid meets the safe-harbor amount, so no underpayment penalty applies. Keep setting
            money aside for the balance with your return.
          </p>
        </>
      )}

      <div className="mt-10 border-t border-line pt-8">
        <p className="max-w-[22ch] text-2xl leading-tight font-medium tracking-[-0.02em] text-ink-2 sm:text-3xl">
          Set aside <span className="font-bold text-ink">{pct(rate, 0)}</span> of every payment.
        </p>
        {catchUp && (
          <p className="mt-3 text-base text-ink-2">
            Catching up? Set aside <span className="font-semibold text-ink">{pct(catchUpRate, 0)}</span> of
            what&rsquo;s still to come.
          </p>
        )}
        <p className="mt-5 max-w-[60ch] text-sm text-ink-2">{result.safeHarbor.reason}</p>
        <Disclaimer className="mt-3" />
      </div>
    </section>
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

/** Past-due headline: pay the missed amount now, what each week of waiting costs, then the next deadline. */
function PayNowHeadline({ payNow }: { payNow: PayNow }) {
  const { amount, pastDueText, weeklyPenalty, then, penaltySoFar } = payNow;
  return (
    <>
      <h1
        id="pay-title"
        className="max-w-[17ch] text-[2.4rem] leading-[1.08] font-medium tracking-[-0.03em] text-ink-2 sm:text-5xl sm:leading-[1.05] lg:text-[3.5rem]"
      >
        Pay <span className="font-bold text-ink">{money(amount)}</span> now.
      </h1>
      <p className="mt-5 flex max-w-[52ch] gap-2.5 text-base font-medium text-red">
        <span aria-hidden className="mt-[0.55em] size-2 shrink-0 rounded-full bg-red" />
        <span>
          {pastDueText}{" "}
          {weeklyPenalty !== null
            ? `Every week adds ${aboutMoney(weeklyPenalty)} in penalty.`
            : "Penalty grows daily until it\u2019s paid."}
        </span>
      </p>
      {then && (
        <p className="mt-4 text-xl leading-snug tracking-[-0.01em] text-ink-2 sm:text-2xl">
          Then <span className="font-bold text-ink">{money(then.amount)}</span> by{" "}
          <span className="font-bold whitespace-nowrap text-ink">{longDate(then.due)}</span>
        </p>
      )}
      <DirectPay />
      <p className="mt-4 text-xs text-ink-3">
        Penalty so far: {aboutMoney(penaltySoFar)} (estimate)
        <span className="mt-0.5 block">Assumes the payments you entered were made on time.</span>
      </p>
    </>
  );
}
