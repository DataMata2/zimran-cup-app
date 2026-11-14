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

const linkClass = "font-bold text-ink underline decoration-2 underline-offset-3 hover:bg-sun-soft";
const h2Class = "font-display text-[1.375rem] leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[1.75rem]";
const matchChip =
  "inline-block rounded-md border-2 border-ink bg-mint-soft px-2.5 py-1 text-sm leading-snug font-bold text-ink";

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
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-8 pb-16 sm:px-6 sm:pt-14">
      <h1 className="font-display text-[2.25rem] leading-[1.02] font-extrabold tracking-[-0.04em] text-ink sm:text-5xl">How we check our numbers</h1>
      <p className="mt-4 max-w-[65ch] text-base text-ink-2 sm:text-lg">
        Every amount you see in Penaltyproof comes from a tax engine that follows the IRS&rsquo;s published 2026 rules. Here
        is how it works and how we test it.
      </p>

      <Card as="section" aria-labelledby="engine-title" className="mt-10">
        <h2 id="engine-title" className={h2Class}>
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
            <span className="font-bold text-ink">{ENGINE_TEST_COUNT} engine tests</span> check the maths against the IRS
            worksheets, down to the cent.
          </p>
        </div>
      </Card>

      <Card as="section" aria-labelledby="sources-title" className="mt-8">
        <h2 id="sources-title" className={h2Class}>
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
      </Card>

      <section aria-labelledby="personas-title" className="mt-10">
        <h2 id="personas-title" className={h2Class}>
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
                <h3 className="font-display text-lg leading-snug font-extrabold tracking-[-0.02em] text-ink">
                  {p.id}. {p.who}
                </h3>
                <div>
                  <p className="font-mono text-xs font-bold tracking-[0.08em] text-ink uppercase">Engine</p>
                  <div className="mt-1 tabular-nums">
                    <EngineLines p={p} />
                  </div>
                </div>
                <div>
                  <p className="font-mono text-xs font-bold tracking-[0.08em] text-ink uppercase">Worksheet by hand</p>
                  <p className="mt-1 tabular-nums">{p.hand}</p>
                  <p className="mt-2">
                    <span className={matchChip}>Matches the engine to the cent</span>
                  </p>
                </div>
                <div>
                  <p className="font-mono text-xs font-bold tracking-[0.08em] text-ink uppercase">A popular free calculator</p>
                  <p className="mt-1 tabular-nums">{p.calculator}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        {/* Wider screens: a table. Any overflow scrolls inside the box, not the page. */}
        <div className="mt-6 hidden overflow-x-auto rounded-lg border-3 border-ink bg-surface shadow-hard md:block">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm text-ink-2">
            <thead>
              <tr className="bg-ink text-white">
                <th scope="col" className="w-[22%] px-4 py-3 font-mono text-xs font-bold tracking-[0.08em] uppercase">
                  Persona
                </th>
                <th scope="col" className="w-[34%] px-4 py-3 font-mono text-xs font-bold tracking-[0.08em] uppercase">
                  Engine
                </th>
                <th scope="col" className="w-[22%] px-4 py-3 font-mono text-xs font-bold tracking-[0.08em] uppercase">
                  1040-ES worksheet by hand
                </th>
                <th scope="col" className="w-[22%] px-4 py-3 font-mono text-xs font-bold tracking-[0.08em] uppercase">
                  A popular free calculator
                </th>
              </tr>
            </thead>
            <tbody>
              {VERIFIED_PERSONAS.map((p) => (
                <tr key={p.id} className="border-b-2 border-ink align-top last:border-b-0">
                  <th scope="row" className="px-4 py-4 font-normal">
                    <span className="font-bold text-ink">{p.id}.</span> {p.who}
                  </th>
                  <td className="px-4 py-4 tabular-nums">
                    <EngineLines p={p} />
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    {p.hand}
                    <span className="mt-2 block">
                      <span className={matchChip}>Matches to the cent</span>
                    </span>
                  </td>
                  <td className="px-4 py-4 tabular-nums">{p.calculator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-10 border-t-2 border-ink pt-6 text-sm text-ink-2">{DISCLAIMER_TEXT}</p>
    </main>
  );
}
