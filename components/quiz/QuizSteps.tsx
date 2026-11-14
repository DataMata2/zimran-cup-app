"use client";

import { useRef } from "react";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { Field, MoneyInput } from "@/components/kit/Field";
import { money } from "@/lib/product/format";
import { suggestExpectedIncome, type QuizDraft, type QuizFilingStatus, type StepErrors } from "@/lib/product/quiz";
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
      className="flex flex-col gap-2.5"
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
            className={cx(
              "flex min-h-16 cursor-pointer items-center gap-4 rounded-md border bg-surface px-4 py-3 transition-[border-color,background-color,box-shadow] duration-150",
              "has-[input:focus-visible]:shadow-[0_0_0_3px_var(--color-accent-soft)] has-[input:focus-visible]:border-accent",
              checked ? "border-accent bg-accent-soft/50" : "border-line-strong hover:border-ink-3",
            )}
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
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-semibold text-ink">{o.label}</span>
              <span className="text-sm text-ink-2">{o.detail}</span>
            </span>
            <span
              aria-hidden
              className={cx(
                "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                checked ? "border-accent" : "border-line-strong",
              )}
            >
              <span className={cx("size-2.5 rounded-full bg-accent transition-transform", checked ? "scale-100" : "scale-0")} />
            </span>
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
    <StatePicker
      value={draft.state}
      onChange={(state) => update({ state })}
      onPicked={(state: StateCode) => advance({ ...draft, state })}
      labelledBy={questionId}
    />
  );
}

// ---------------------------------------------------------------------------------------------------
// 3. Freelance income

export function IncomeStep({ draft, update, errors, touch, asOf }: StepProps & { asOf: string }) {
  const suggestion = suggestExpectedIncome(draft.ytdIncome, asOf);
  const showUse = suggestion !== null && draft.expectedIncome === null;

  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Received so far in 2026"
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
          allowCents={false}
          enterKeyHint="next"
          data-autofocus
        />
      </Field>
      <Field
        label="Expected for all of 2026"
        hint={
          suggestion !== null
            ? `At your pace so far, about ${money(suggestion)} for the year.`
            : "What you expect clients to pay you by Dec 31, including what they already have."
        }
        error={errors.expectedIncome}
      >
        <MoneyInput
          value={draft.expectedIncome}
          onValueChange={(expectedIncome) => update({ expectedIncome })}
          onBlur={() => touch("expectedIncome")}
          allowCents={false}
          enterKeyHint="go"
          placeholder={suggestion !== null ? money(suggestion).slice(1) : "0"}
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
    <div className="flex flex-col gap-5">
      <button
        type="button"
        role="switch"
        aria-checked={draft.hasW2}
        onClick={toggle}
        data-autofocus
        className={cx(
          "flex min-h-16 w-full items-center gap-4 rounded-md border bg-surface px-4 py-3 text-left transition-[border-color,background-color] duration-150",
          draft.hasW2 ? "border-accent bg-accent-soft/50" : "border-line-strong hover:border-ink-3",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-semibold text-ink">I also have a W-2 job</span>
          <span className="text-sm text-ink-2">
            {joint ? "You or your spouse, any paycheck job in 2026" : "Any paycheck job in 2026, full or part time"}
          </span>
        </span>
        <span
          aria-hidden
          className={cx(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150",
            draft.hasW2 ? "bg-accent" : "bg-line-strong",
          )}
        >
          <span
            className={cx(
              "absolute top-0.5 left-0.5 size-6 rounded-full bg-surface shadow-[0_1px_2px_rgb(23_32_28/0.25)] transition-transform duration-150 ease-out-soft",
              draft.hasW2 && "translate-x-5",
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
              allowCents={false}
              enterKeyHint="next"
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
              allowCents={false}
              enterKeyHint="go"
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
    <div className="flex flex-col gap-5">
      {draft.priorKnown && (
        <>
          <Field label="Total tax for 2025" hint="Form 1040, line 24" error={errors.priorYearTax}>
            <MoneyInput
              value={draft.priorYearTax}
              onValueChange={(priorYearTax) => update({ priorYearTax })}
              onBlur={() => touch("priorYearTax")}
              allowCents={false}
              enterKeyHint="next"
              data-autofocus
            />
          </Field>
          <Field label="Adjusted gross income for 2025" hint="Form 1040, line 11" error={errors.priorYearAgi}>
            <MoneyInput
              value={draft.priorYearAgi}
              onValueChange={(priorYearAgi) => update({ priorYearAgi })}
              onBlur={() => touch("priorYearAgi")}
              allowCents={false}
              enterKeyHint="go"
            />
          </Field>
        </>
      )}

      <label
        className={cx(
          "flex min-h-13 cursor-pointer items-center gap-3 rounded-md border bg-surface px-4 py-3 transition-[border-color,background-color] duration-150",
          "has-[input:focus-visible]:border-accent has-[input:focus-visible]:shadow-[0_0_0_3px_var(--color-accent-soft)]",
          draft.priorKnown ? "border-line-strong hover:border-ink-3" : "border-accent bg-accent-soft/50",
        )}
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
            "flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition-colors",
            draft.priorKnown ? "border-line-strong" : "border-accent bg-accent",
          )}
        >
          {!draft.priorKnown && (
            <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-white stroke-[2.5]">
              <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="text-base font-semibold text-ink">I don&rsquo;t know</span>
      </label>

      {!draft.priorKnown && (
        <p className="rounded-md border border-line bg-sunken px-4 py-3 text-sm text-ink-2">
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
    <div className="flex flex-col gap-4">
      <Field label="Paid so far for 2026" error={errors.estimatedPaid}>
        <MoneyInput
          value={draft.estimatedPaid}
          onValueChange={(estimatedPaid) => update({ estimatedPaid })}
          onBlur={() => touch("estimatedPaid")}
          allowCents={false}
          enterKeyHint="go"
          data-autofocus
        />
      </Field>
      <Button variant="secondary" size="md" className="self-start" onClick={noneYet}>
        None yet
      </Button>
    </div>
  );
}
