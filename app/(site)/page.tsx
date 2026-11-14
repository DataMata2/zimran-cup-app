import { DeadlinePreview } from "@/components/landing/DeadlinePreview";
import { HeroActions } from "@/components/landing/HeroActions";
import { PlanPreview } from "@/components/landing/PlanPreview";
import { Button } from "@/components/kit/Button";

const STEPS = [
  {
    title: "Answer six questions",
    body: "Filing status, state, what clients have paid you so far, and last year’s tax if you know it. About two minutes.",
  },
  {
    title: "Get your two numbers",
    body: "The share of every payment to set aside, and the minimum to pay by the next deadline to stay clear of the penalty.",
  },
  {
    title: "Log each payment as it lands",
    body: "Tell us when a client pays. You see what to set aside from it, and your meter fills toward the safe-harbor target.",
  },
] as const;

const BENEFITS = [
  {
    title: "The minimum, not a guess",
    body: "The IRS doesn’t charge the penalty if you pay its safe-harbor amount on time. We work out that amount from this year’s income or last year’s tax, whichever asks less of you.",
  },
  {
    title: "Every deadline, with the amount",
    body: "All four quarterly due dates with what to pay on each, plus your expected balance with the April return. Add them to your calendar in one tap.",
  },
  {
    title: "Federal and your state",
    body: "Self-employment tax, federal income tax and your state’s income tax, in one number to set aside.",
  },
] as const;

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Hero: headline and both actions fit in the first screen at 375px. */}
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-8 pb-14 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-16 lg:pt-20 lg:pb-24">
        <div className="flex min-w-0 flex-col">
          <h1 className="max-w-[18ch] text-[2rem] [font-variant-numeric:proportional-nums] leading-[1.08] font-bold tracking-[-0.025em] text-ink sm:text-5xl sm:leading-[1.05] lg:text-[3.6rem]">
            Freelancer? The IRS charged 15.7 million underpayment penalties last year.
          </h1>
          <p className="mt-4 max-w-[46ch] text-base text-ink-2 sm:mt-6 sm:text-lg">
            Penaltyproof tells you how much to set aside from every payment, and the minimum to pay the IRS by
            each quarterly deadline so you never owe that penalty.
          </p>
          <div className="mt-7 sm:mt-9">
            <HeroActions />
          </div>
          <figure className="mt-10 max-w-md border-l-2 border-accent pl-4 sm:mt-12">
            <p className="text-lg font-semibold text-ink">$12.06B in estimated-tax penalties, ~$766 each.</p>
            <figcaption className="mt-1 text-sm text-ink-3">IRS Data Book FY2025, Table 4-2</figcaption>
          </figure>
        </div>

        <div className="min-w-0 lg:pl-4">
          <PlanPreview />
        </div>
      </section>

      {/* How it works: a real sequence, so it is numbered. */}
      <section aria-labelledby="how-title" className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 id="how-title" className="text-xl font-bold tracking-[-0.015em] text-ink sm:text-2xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 sm:flex-col sm:gap-4">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-accent/40 text-sm font-bold text-accent"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1.5 max-w-[38ch] text-sm text-ink-2">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you get: the example persona's real schedule next to what each part means. */}
      <section aria-labelledby="get-title" className="border-t border-line">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div className="min-w-0">
            <h2 id="get-title" className="text-xl font-bold tracking-[-0.015em] text-ink sm:text-2xl">
              What you get
            </h2>
            <dl className="mt-8 flex flex-col gap-7">
              {BENEFITS.map((b) => (
                <div key={b.title}>
                  <dt className="text-base font-semibold text-ink">{b.title}</dt>
                  <dd className="mt-1.5 max-w-[52ch] text-sm text-ink-2">{b.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="min-w-0 lg:pt-14">
            <p className="mb-3 text-sm text-ink-2">Maya&rsquo;s deadlines for 2026</p>
            <DeadlinePreview />
          </div>
        </div>
      </section>

      {/* Price teaser */}
      <section aria-labelledby="price-title" className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="flex flex-col gap-6 rounded-lg border border-accent-mid/50 bg-accent-soft p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            <div className="min-w-0">
              <h2 id="price-title" className="text-xl font-bold tracking-[-0.015em] text-accent-ink sm:text-2xl">
                $59 per tax year — less than one penalty.
              </h2>
              <p className="mt-2 max-w-[60ch] text-sm text-ink-2">
                Your plan and your first three logged payments are free. Pro adds unlimited logging, reading
                payouts from a screenshot, a plan for uneven income, and a CSV for your accountant. Or $9.99 a
                month.
              </p>
            </div>
            <Button href="/start" size="lg" className="w-full shrink-0 sm:w-auto">
              Get my number (no sign-up)
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
