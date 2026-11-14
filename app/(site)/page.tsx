import { DeadlinePreview } from "@/components/landing/DeadlinePreview";
import { HeroActions } from "@/components/landing/HeroActions";
import { PlanPreview } from "@/components/landing/PlanPreview";
import { WantedPoster } from "@/components/landing/WantedPoster";
import { Button } from "@/components/kit/Button";

const STEPS = [
  {
    title: "Answer six questions",
    body: "Filing status, state, your freelance profit so far, and last year’s tax if you know it. About two minutes.",
  },
  {
    title: "Get your two numbers",
    body: "The share of every payment to set aside, and the minimum to pay by the next deadline to stay clear of the penalty.",
  },
  {
    title: "Log each payment as it lands",
    body: "Tell us when a client pays and you see what to set aside from it. Log what you pay the IRS and the meter shows how much of the minimum is covered.",
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

const GUTTER = "mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-10";
const SECTION_TITLE =
  "text-[2.5rem] leading-[1] font-extrabold tracking-[-0.035em] text-ink sm:text-5xl lg:text-[3.5rem]";

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Hero. Phone: eyebrow, headline, sub, CTA and the example link fill the first screen; the poster follows. */}
      <section
        className={`${GUTTER} grid gap-16 pt-6 pb-4 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-center lg:gap-12 lg:pt-10 lg:pb-8`}
      >
        <div className="flex min-w-0 flex-col">
          <p className="mt-2 mb-3 font-mono text-[13px] leading-none font-bold tracking-[0.1em] text-ink uppercase min-[481px]:hidden">
            Freelancer?
          </p>
          <h1 className="text-[2.875rem] leading-none font-extrabold tracking-[-0.045em] text-ink [font-variation-settings:'opsz'_96] min-[481px]:text-[clamp(2.75rem,8vw,4.5rem)] min-[481px]:leading-[0.94] lg:text-[clamp(3.25rem,calc((100vw_-_488px)/9.6),4.5rem)] max-[359px]:text-[2.5rem]">
            <span className="max-[480px]:hidden">Freelancer? The IRS charged </span>
            <span className="my-[0.04em] inline-block -rotate-[1.5deg] rounded-md border-3 border-ink bg-sun px-[0.12em] shadow-[3px_3px_0_0_var(--color-ink)] sm:shadow-chip lg:shadow-[4px_4px_0_0_var(--color-ink)]">
              15.7&nbsp;million
            </span>{" "}
            <span className="min-[481px]:hidden">IRS </span>
            <span className="min-[481px]:text-hot min-[481px]:[-webkit-text-stroke:2px_var(--color-ink)] min-[481px]:[paint-order:stroke_fill] lg:[-webkit-text-stroke:3px_var(--color-ink)]">
              estimated-tax penalties
            </span>{" "}
            in fiscal&nbsp;2025.
          </h1>
          <p className="mt-4 max-w-[560px] text-[17px] leading-[1.5] text-ink min-[481px]:hidden">
            Know what to set aside from every payment and what to pay by each deadline, so you don’t owe the
            penalty.
          </p>
          <p className="mt-6 max-w-[560px] text-[19px] leading-[1.5] text-ink max-[480px]:hidden lg:text-[21px]">
            Penaltyproof tells you how much to set aside from every payment, and the minimum to pay the IRS by
            each quarterly deadline so you don’t owe that penalty.
          </p>
          <div className="mt-6 sm:mt-8">
            <HeroActions />
          </div>
        </div>

        <WantedPoster />
      </section>

      {/* How it works: a real sequence, so it is numbered. */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-4">
        <div className={`${GUTTER} pt-20 pb-16 lg:pt-28 lg:pb-20`}>
          <h2 id="how-title" className={SECTION_TITLE}>
            How it works
          </h2>
          <ol className="mt-12 grid gap-12 sm:grid-cols-3 sm:gap-6 lg:gap-8">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="relative rounded-lg border-3 border-ink bg-surface px-5 pt-9 pb-6 shadow-hard sm:px-6"
              >
                <span
                  aria-hidden
                  className={`absolute -top-6 left-5 grid size-12 place-items-center rounded-full border-3 border-ink font-display text-2xl leading-none font-extrabold text-ink shadow-chip ${
                    i === 0 ? "-rotate-6 bg-sun" : i === 1 ? "rotate-3 bg-sky" : "-rotate-3 bg-mint"
                  }`}
                >
                  {i + 1}
                </span>
                <h3 className="text-[1.375rem] leading-[1.15] font-extrabold tracking-[-0.025em] text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-base text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you get: the example persona's real numbers and schedule next to what each part means. */}
      <section aria-labelledby="get-title">
        <div className={`${GUTTER} py-16 lg:py-20`}>
          <h2 id="get-title" className={SECTION_TITLE}>
            What you get
          </h2>
          <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-12">
            <dl className="flex min-w-0 flex-col gap-8">
              {BENEFITS.map((b) => (
                <div key={b.title} className="flex gap-4">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-3 border-ink bg-mint"
                  >
                    <svg viewBox="0 0 14 14" className="size-3.5">
                      <path
                        d="m2.5 7.5 3 3 6-7"
                        fill="none"
                        className="stroke-ink"
                        strokeWidth={2.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[1.25rem] leading-[1.2] font-extrabold tracking-[-0.02em] text-ink font-display">
                      {b.title}
                    </dt>
                    <dd className="mt-1.5 max-w-[52ch] text-base text-ink-2">{b.body}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <div className="min-w-0 lg:row-span-2">
              <PlanPreview />
            </div>
            <div className="min-w-0">
              <p className="mb-3 font-mono text-xs font-bold tracking-[0.08em] text-ink uppercase">
                Maya&rsquo;s deadlines for 2026
              </p>
              <DeadlinePreview />
            </div>
          </div>
        </div>
      </section>

      {/* Price teaser: a sun card. */}
      <section aria-labelledby="price-title">
        <div className={`${GUTTER} pt-8 pb-20 lg:pb-28`}>
          <div className="flex flex-col gap-6 rounded-lg border-3 border-ink bg-sun p-6 shadow-hard sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            <div className="min-w-0">
              <h2
                id="price-title"
                className="text-[2rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-ink sm:text-[2.75rem]"
              >
                $59 a year — less than one penalty.
              </h2>
              <p className="mt-3 max-w-[60ch] text-base text-ink">
                Your plan, every IRS payment you log and your first three client payments are free. Pro adds unlimited logging, reading
                payouts from a screenshot, a plan for uneven income, and a CSV for your accountant. Or $9.99 a
                month.
              </p>
            </div>
            <Button href="/start" variant="dark" size="lg" className="w-full shrink-0 sm:w-auto">
              Get my number (no sign-up)
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
