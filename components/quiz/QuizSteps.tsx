"use client";

import { useRef } from "react";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { Field, MoneyInput } from "@/components/kit/Field";
import { money } from "@/lib/product/format";
import { paidSoFarNote, suggestExpectedIncome, type QuizDraft, type QuizFilingStatus, type StepErrors } from "@/lib/product/quiz";
import type { StateCode } from "@/lib/tax";
import { FILING_OPTIONS } from "./copy";
import { StatePicker } from "./StatePicker";

/** What every step body gets from the quiz. */
export interface StepProps {
  draft: QuizDraft;
  update: (patch: Partial<QuizDraft>) => void;
  /** Field-level messages to show now (already filtered by touched / attempted). */
  errors: StepErrors;
  /** Mark a field as touched (on blur), so its conflict message may show. */
  touch: (field: string) => void;
  /** Move on (as if Continue was pressed), after a tap that answers the question outright. */
  advance: (draft: QuizDraft) => void;
  questionId: string;
}

// ---------------------------------------------------------------------------------------------------
// Shared looks

/**
 * A game tile: white, 3px ink edge, a hard ink ledge it sinks into when pressed; chosen = sun.
 * Focus (keyboard) draws the global ink outline around the whole tile.
 */
const tileBase =
  "relative flex w-full cursor-pointer items-center gap-3.5 rounded-md border-3 border-ink px-4 py-3 text-left " +
  "transition-[transform,box-shadow,background-color] duration-100 ease-out " +
  "has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-ink " +
  "motion-safe:active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)]";
const tileOff = "bg-surface shadow-[0_4px_0_var(--color-ink)] hover:bg-sky-soft sm:shadow-[0_6px_0_var(--color-ink)]";
const tileOn =
  "bg-sun shadow-[0_2px_0_var(--color-ink)] motion-safe:translate-y-0.5 sm:shadow-[0_4px_0_var(--color-ink)]";

const tileTitle = "block font-display text-lg leading-tight font-extrabold tracking-[-0.025em] text-ink sm:text-[1.3125rem]";
const tileHint = "mt-0.5 block text-sm leading-snug sm:mt-1 sm:text-[15px]";

/** Money fields in the quiz: the kit MoneyInput, taller, with the amount in big display type. */
const bigMoney = "h-16! [&_input]:text-[1.75rem] [&>span]:text-[1.75rem] [&>span]:pr-1.5";

/** Round check badge: empty ring, or ink with a white tick when chosen. */
function CheckBadge({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid size-7 shrink-0 place-items-center self-center rounded-full border-2 border-ink sm:self-start",
        on ? "bg-ink" : "bg-surface",
      )}
    >
      {on && (
        <svg viewBox="0 0 14 14" className="size-3.5 fill-none stroke-white stroke-[2.6]">
          <path d="m2.5 7.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/** Decorative filing-status pictures (desktop tiles only; phones show the title and hint). */
function FilingIcon({ value }: { value: QuizFilingStatus }) {
  const ink = { stroke: "var(--color-ink)", strokeWidth: 2.5, strokeLinejoin: "round" as const };
  switch (value) {
    case "single":
      return (
        <svg viewBox="0 0 30 30" className="size-[30px]">
          <circle cx="15" cy="10" r="5.5" fill="var(--color-sky)" {...ink} />
          <path d="M5 27c1-6 5-9 10-9s9 3 10 9z" fill="var(--color-sun)" {...ink} />
        </svg>
      );
    case "mfj":
      return (
        <svg viewBox="0 0 34 30" className="h-[30px] w-[34px]">
          <circle cx="11" cy="10" r="5" fill="var(--color-sky)" {...ink} />
          <circle cx="23" cy="10" r="5" fill="var(--color-mint)" {...ink} />
          <rect x="4" y="18" width="26" height="9" rx="4" fill="var(--color-sun)" {...ink} />
        </svg>
      );
    case "mfs":
      return (
        <svg viewBox="0 0 34 30" className="h-[30px] w-[34px]">
          <circle cx="9" cy="10" r="5" fill="var(--color-sky)" {...ink} />
          <circle cx="25" cy="10" r="5" fill="var(--color-mint)" {...ink} />
          <rect x="2" y="18" width="13" height="9" rx="4" fill="var(--color-sun)" {...ink} />
          <rect x="19" y="18" width="13" height="9" rx="4" fill="var(--color-sun)" {...ink} />
        </svg>
      );
    case "hoh":
      return (
        <svg viewBox="0 0 30 30" className="size-[30px]">
          <path d="M4 14 15 4l11 10v12H4z" fill="var(--color-sun)" {...ink} />
          <rect x="12" y="17" width="6" height="9" fill="var(--color-sky)" {...ink} />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------------------------------
// 1. Filing status

export function FilingStep({ draft, update, advance, questionId }: StepProps) {
  // A tap answers the question and moves on; arrow keys only change the choice.
  const byPointer = useRef(false);

  function choose(value: QuizFilingStatus) {
    update({ filingStatus: value });
    if (byPointer.current) advance({ ...draft, filingStatus: value });
    byPointer.current = false;
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={questionId}
      onKeyDown={() => {
        byPointer.current = false;
      }}
      className="grid gap-3 sm:grid-cols-2 sm:gap-[18px]"
    >
      {FILING_OPTIONS.map((o, i) => {
        const checked = draft.filingStatus === o.value;
        const autofocus = checked || (draft.filingStatus === null && i === 0);
        return (
          <label
            key={o.value}
            onPointerDown={() => {
              byPointer.current = true;
            }}
            className={cx(tileBase, "sm:min-h-24 sm:items-start sm:p-4", checked ? tileOn : tileOff)}
          >
            <input
              type="radio"
              name="filingStatus"
              value={o.value}
              checked={checked}
              onChange={() => choose(o.value)}
              onClick={() => {
                // Tapping the option that is already chosen: nothing changes, so move on here.
                if (checked && byPointer.current) {
                  byPointer.current = false;
                  advance(draft);
                }
              }}
              data-autofocus={autofocus || undefined}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cx(
                "hidden size-13 shrink-0 place-items-center rounded-[10px] border-2 border-ink sm:grid",
                checked ? "bg-surface" : "bg-paper",
              )}
            >
              <FilingIcon value={o.value} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={tileTitle}>{o.label}</span>
              <span className={cx(tileHint, checked ? "text-ink" : "text-ink-3")}>{o.detail}</span>
            </span>
            <CheckBadge on={checked} />
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// 2. State

export function StateStep({ draft, update, advance, questionId }: StepProps) {
  return (
    <div className="sm:max-w-lg">
      <StatePicker
        value={draft.state}
        onChange={(state) => update({ state })}
        onPicked={(state: StateCode) => advance({ ...draft, state })}
        labelledBy={questionId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// 3. Freelance income

export function IncomeStep({ draft, update, errors, touch, asOf }: StepProps & { asOf: string }) {
  const suggestion = suggestExpectedIncome(draft.ytdIncome, asOf);
  const showUse = suggestion !== null && draft.expectedIncome === null;

  return (
    <div className="flex flex-col gap-5 sm:max-w-lg">
      <Field
        label="Profit so far in 2026"
        hint={
          draft.editing && draft.loggedCount > 0
            ? `Includes ${money(draft.loggedIncome)} from ${draft.loggedCount} ${draft.loggedCount === 1 ? "payment" : "payments"} you logged.`
            : undefined
        }
        error={errors.ytdIncome}
      >
        <MoneyInput
          value={draft.ytdIncome}
          onValueChange={(ytdIncome) => update({ ytdIncome })}
          onBlur={() => touch("ytdIncome")}
          enterKeyHint="next"
          data-autofocus
          className={bigMoney}
        />
      </Field>
      <Field
        label="Expected for all of 2026"
        hint={
          suggestion !== null
            ? `At your pace so far, about ${money(suggestion)} for the year.`
            : "What clients will have paid you by Dec 31, minus business expenses, including what you’ve earned so far."
        }
        error={errors.expectedIncome}
      >
        <MoneyInput
          value={draft.expectedIncome}
          onValueChange={(expectedIncome) => update({ expectedIncome })}
          onBlur={() => touch("expectedIncome")}
          enterKeyHint="go"
          placeholder={suggestion !== null ? money(suggestion).slice(1) : "0"}
          className={bigMoney}
        />
      </Field>
      {showUse && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => update({ expectedIncome: suggestion })}
        >
          Use {money(suggestion)}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// 4. W-2 job (optional)

export function W2Step({ draft, update, errors, touch }: StepProps) {
  const wagesRef = useRef<HTMLDivElement>(null);
  const joint = draft.filingStatus === "mfj";

  function toggle() {
    const hasW2 = !draft.hasW2;
    update({ hasW2 });
    if (hasW2) requestAnimationFrame(() => wagesRef.current?.querySelector("input")?.focus());
  }

  return (
    <div className="flex flex-col gap-5 sm:max-w-lg">
      <button
        type="button"
        role="switch"
        aria-checked={draft.hasW2}
        onClick={toggle}
        data-autofocus
        className={cx(tileBase, "min-h-18 sm:p-4", draft.hasW2 ? tileOn : tileOff)}
      >
        <span className="min-w-0 flex-1">
          <span className={tileTitle}>I also have a W-2 job</span>
          <span className={cx(tileHint, draft.hasW2 ? "text-ink" : "text-ink-3")}>
            {joint ? "You or your spouse, any paycheck job in 2026" : "Any paycheck job in 2026, full or part time"}
          </span>
        </span>
        <span
          aria-hidden
          className={cx(
            "relative h-8 w-14 shrink-0 rounded-full border-2 border-ink transition-colors duration-150",
            draft.hasW2 ? "bg-mint" : "bg-paper",
          )}
        >
          <span
            className={cx(
              "absolute top-0.5 left-0.5 size-6 rounded-full border-2 border-ink bg-surface transition-transform duration-150 ease-out-soft",
              draft.hasW2 && "translate-x-6",
            )}
          />
        </span>
      </button>

      {draft.hasW2 ? (
        <div ref={wagesRef} className="flex flex-col gap-5">
          <Field
            label="W-2 wages for 2026"
            hint={joint ? "Both of you, the full-year total before taxes." : "The full-year total before taxes."}
            error={errors.w2Wages}
          >
            <MoneyInput
              value={draft.w2Wages}
              onValueChange={(w2Wages) => update({ w2Wages })}
              onBlur={() => touch("w2Wages")}
              enterKeyHint="next"
              className={bigMoney}
            />
          </Field>
          <Field
            label="Federal withholding for 2026"
            hint="Federal income tax withheld over the full year. Your latest pay stub shows it so far."
            error={errors.w2Withholding}
          >
            <MoneyInput
              value={draft.w2Withholding}
              onValueChange={(w2Withholding) => update({ w2Withholding })}
              onBlur={() => touch("w2Withholding")}
              enterKeyHint="go"
              className={bigMoney}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// 5. Last year's tax

export function PriorYearStep({ draft, update, errors, touch }: StepProps) {
  return (
    <div className="flex flex-col gap-5 sm:max-w-lg">
      {draft.priorKnown && (
        <>
          <Field label="Total tax for 2025" hint="Form 1040, line 24" error={errors.priorYearTax}>
            <MoneyInput
              value={draft.priorYearTax}
              onValueChange={(priorYearTax) => update({ priorYearTax })}
              onBlur={() => touch("priorYearTax")}
              enterKeyHint="next"
              data-autofocus
              className={bigMoney}
            />
          </Field>
          <Field label="Adjusted gross income for 2025" hint="Form 1040, line 11" error={errors.priorYearAgi}>
            <MoneyInput
              value={draft.priorYearAgi}
              onValueChange={(priorYearAgi) => update({ priorYearAgi })}
              onBlur={() => touch("priorYearAgi")}
              enterKeyHint="go"
              className={bigMoney}
            />
          </Field>
        </>
      )}

      <label
        className={cx(tileBase, "min-h-14 gap-3", draft.priorKnown ? tileOff : tileOn)}
      >
        <input
          type="checkbox"
          checked={!draft.priorKnown}
          onChange={(e) => update({ priorKnown: !e.target.checked })}
          data-autofocus={!draft.priorKnown || undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cx(
            "flex size-6 shrink-0 items-center justify-center rounded-[6px] border-2 border-ink transition-colors",
            draft.priorKnown ? "bg-surface" : "bg-ink",
          )}
        >
          {!draft.priorKnown && (
            <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-white stroke-[2.6]">
              <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className={tileTitle}>I don&rsquo;t know</span>
      </label>

      {!draft.priorKnown && (
        <p className="rounded-md border-2 border-ink bg-sky-soft px-4 py-3 text-sm text-ink">
          We&rsquo;ll use the 90% rule instead — a bit more conservative.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// 6. Estimated payments so far

export function PaymentsStep({ draft, update, errors, touch, noneYet }: StepProps & { noneYet: () => void }) {
  return (
    <div className="flex flex-col gap-4 sm:max-w-lg">
      <Field label="Paid so far for 2026" hint={paidSoFarNote(draft)} error={errors.estimatedPaid}>
        <MoneyInput
          value={draft.estimatedPaid}
          onValueChange={(estimatedPaid) => update({ estimatedPaid })}
          onBlur={() => touch("estimatedPaid")}
          enterKeyHint="go"
          data-autofocus
          className={bigMoney}
        />
      </Field>
      <Button variant="secondary" size="md" className="self-start" onClick={noneYet}>
        None yet
      </Button>
    </div>
  );
}
