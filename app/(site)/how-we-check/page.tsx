import type { Metadata } from "next";
import { Card } from "@/components/kit/Card";
import { DISCLAIMER_TEXT } from "@/components/kit/Disclaimer";
import { ENGINE_TEST_COUNT } from "@/lib/product/trust";
import { VERIFIED_AS_OF, VERIFIED_PERSONAS, VERIFIED_SOURCES, type VerifiedPersona } from "@/lib/product/verified";

export const metadata: Metadata = {
  title: "How we check our numbers — Penaltyproof",
  description:
    "Penaltyproof's numbers come from a deterministic tax engine built on the IRS's own 2026 rules, tested against the Form 1040-ES worksheet worked by hand.",
};

const linkClass = "font-medium text-accent underline decoration-accent-mid underline-offset-2 hover:text-accent-hover";

function EngineLines({ p }: { p: VerifiedPersona }) {
  return (
    <ul className="flex flex-col gap-1">
      {p.engine.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

// A static explainer: what makes the numbers, where the rules come from, and the hand-checked personas.
export default function HowWeCheckPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-16 sm:px-6 sm:pt-14">
      <h1 className="text-[2rem] leading-tight font-bold tracking-[-0.025em] text-ink sm:text-4xl">How we check our numbers</h1>
      <p className="mt-3 max-w-[65ch] text-base text-ink-2">
        Every amount you see in Penaltyproof comes from a tax engine that follows the IRS&rsquo;s published 2026 rules. Here
        is how it works and how we test it.
      </p>

      <section aria-labelledby="engine-title" className="mt-10">
        <h2 id="engine-title" className="text-xl font-bold tracking-[-0.015em] text-ink">
          A tax engine does the maths, the AI only explains
        </h2>
        <div className="mt-3 flex max-w-[65ch] flex-col gap-3 text-base text-ink-2">
          <p>
            The engine is plain code with no AI in it. The same answers give the same numbers every time: your tax for the
            year, the safe-harbor minimum, what is due by each deadline and the share of each payment to set aside.
          </p>
          <p>
            The AI features explain those numbers in plain words and read amounts from a screenshot for you to confirm. They
            never calculate a tax figure.
          </p>
          <p>
            <span className="font-semibold text-ink">{ENGINE_TEST_COUNT} engine tests</span> check the maths against the IRS
            worksheets, down to the cent.
          </p>
        </div>
      </section>

      <section aria-labelledby="sources-title" className="mt-10">
        <h2 id="sources-title" className="text-xl font-bold tracking-[-0.015em] text-ink">
          Where the rules come from
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {VERIFIED_SOURCES.map((s) => (
            <li key={s.name} className="max-w-[65ch] text-base text-ink-2">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {s.name}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              : {s.what}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="personas-title" className="mt-10">
        <h2 id="personas-title" className="text-xl font-bold tracking-[-0.015em] text-ink">
          Checked against the IRS worksheet by hand
        </h2>
        <p className="mt-3 max-w-[65ch] text-base text-ink-2">
          We ran four freelancers through the engine and through the 2026 Form 1040-ES worksheet by hand (tax year 2026, as
          of {VERIFIED_AS_OF}, Texas, so federal tax only). The engine matches the hand-done worksheet to the cent for all
          four. &ldquo;Required for the year&rdquo; is the safe-harbor minimum (Form 1040-ES line 12c). &ldquo;Due by Jan
          15&rdquo; is what has to be paid by Jan 15, 2027 when nothing has been paid yet. For comparison, the last column
          shows what a popular free calculator asks for.
        </p>

        {/* Phones: one card per persona. */}
        <ul className="mt-5 flex flex-col gap-4 md:hidden">
          {VERIFIED_PERSONAS.map((p) => (
            <li key={p.id}>
              <Card as="article" className="flex flex-col gap-3 text-sm text-ink-2">
                <h3 className="text-base font-semibold text-ink">
                  {p.id}. {p.who}
                </h3>
                <div>
                  <p className="font-semibold text-ink">Engine</p>
                  <div className="mt-1 tabular-nums">
                    <EngineLines p={p} />
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-ink">Worksheet by hand</p>
                  <p className="mt-1 tabular-nums">{p.hand}</p>
                  <p className="mt-1 font-medium text-accent-ink">Matches the engine to the cent</p>
                </div>
                <div>
                  <p className="font-semibold text-ink">A popular free calculator</p>
                  <p className="mt-1 tabular-nums">{p.calculator}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        {/* Wider screens: a table. Any overflow scrolls inside the box, not the page. */}
        <div className="mt-5 hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm text-ink-2">
            <thead>
              <tr className="border-b border-line text-ink">
                <th scope="col" className="w-[22%] px-4 py-3 font-semibold">
                  Persona
                </th>
                <th scope="col" className="w-[34%] px-4 py-3 font-semibold">
                  Engine
                </th>
                <th scope="col" className="w-[22%] px-4 py-3 font-semibold">
                  1040-ES worksheet by hand
                </th>
                <th scope="col" className="w-[22%] px-4 py-3 font-semibold">
                  A popular free calculator
                </th>
              </tr>
            </thead>
            <tbody>
              {VERIFIED_PERSONAS.map((p) => (
                <tr key={p.id} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="px-4 py-4 font-normal">
                    <span className="font-semibold text-ink">{p.id}.</span> {p.who}
                  </th>
                  <td className="px-4 py-4 tabular-nums">
                    <EngineLines p={p} />
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    {p.hand}
                    <span className="mt-1 block font-medium text-accent-ink">Matches to the cent</span>
                  </td>
                  <td className="px-4 py-4 tabular-nums">{p.calculator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-10 border-t border-line pt-6 text-sm text-ink-3">{DISCLAIMER_TEXT}</p>
    </main>
  );
}
