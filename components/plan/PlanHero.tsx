import { buttonClasses } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { Disclaimer } from "@/components/kit/Disclaimer";
import { dateList, longDate, money, pct } from "@/lib/product/format";
import { pastDuePart, payTarget } from "@/lib/product/plan";
import type { TaxResult } from "@/lib/tax";

const DIRECT_PAY_URL = "https://www.irs.gov/payments/direct-pay";

/** The two numbers: what to pay by the next deadline, and the share of every payment to set aside. */
export function PlanHero({ result, className }: { result: TaxResult; className?: string }) {
  const target = payTarget(result);
  const missed = pastDuePart(result);
  const { rate, catchUpRate } = result.setAside;
  const catchUp = catchUpRate > rate + 0.0005;

  return (
    <section aria-labelledby="pay-title" className={cx("min-w-0", className)}>
      {target ? (
        <>
          <h1
            id="pay-title"
            className="max-w-[17ch] text-[2.4rem] leading-[1.08] font-medium tracking-[-0.03em] text-ink-2 sm:text-5xl sm:leading-[1.05] lg:text-[3.5rem]"
          >
            Pay <span className="font-bold text-ink">{money(target.amount)}</span> by{" "}
            <span className="font-bold whitespace-nowrap text-ink">{longDate(target.due)}</span> to stay
            penalty-proof.
          </h1>
          {missed && target.isNext && (
            <p className="mt-5 max-w-[52ch] rounded-md border border-amber-mid/50 bg-amber-soft px-4 py-3 text-sm font-medium text-amber">
              Includes {money(missed.amount)} you missed on {dateList(missed.dues)}. Pay it now to stop the penalty
              growing.
            </p>
          )}
          {!target.isNext && result.nextDeadline && (
            <p className="mt-4 text-base text-ink-2">
              You&rsquo;ve already covered the {longDate(result.nextDeadline.due)} deadline.
            </p>
          )}
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
