"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Wordmark } from "@/components/site/Wordmark";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { todayIso } from "@/lib/product/asof";
import {
  checkWithEngine,
  clampStep,
  draftToProfile,
  loggedIncomeOf,
  firstIncompleteStep,
  QUIZ_STEPS,
  stepErrors,
  type EngineProblem,
  type QuizDraft,
  type QuizStep,
  type StepErrors,
} from "@/lib/product/quiz";
import { chooseDraft, clearDraft, loadDraft, saveDraft } from "@/lib/product/quizDraft";
import { getLog, getProfile, setProfile, useHydrated } from "@/lib/product/store";
import { STEP_COPY } from "./copy";
import { FilingStep, IncomeStep, PaymentsStep, PriorYearStep, StateStep, W2Step, type StepProps } from "./QuizSteps";
import { useKeyboardInset } from "./useKeyboardInset";

/** Delay before a tap-to-answer moves on, so the choice is seen to land. */
const ADVANCE_DELAY_MS = 220;

function stepFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get("step");
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) ? n : null;
}

/**
 * Start where the URL says (a refresh), else where the saved draft was, never past an unanswered step.
 * A saved draft only counts as an edit while there is still a plan of your own to edit (it may have been
 * reset or replaced since).
 */
function initialDraft(): QuizDraft {
  const stored = getProfile();
  const ownPlan = stored !== null && !stored.isExample;
  const chosen = chooseDraft(loadDraft(), stored, getLog());
  const draft = { ...chosen, editing: chosen.editing && ownPlan };
  return { ...draft, step: clampStep(draft, stepFromUrl() ?? draft.step) };
}

/**
 * On a phone the Continue bar is pinned above the keyboard; scroll so the focused field sits above the
 * bar rather than under it. (Desktop: the bar is in the flow, nothing to do.)
 */
function keepAboveBar(el: HTMLElement, bar: HTMLElement | null) {
  if (!bar || getComputedStyle(bar).position !== "fixed") return;
  const vv = window.visualViewport;
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const limit = Math.min(visibleBottom, bar.getBoundingClientRect().top) - 12;
  const overlap = el.getBoundingClientRect().bottom - limit;
  if (overlap > 0) window.scrollBy({ top: overlap });
}

/** /start: renders the frame on the server, the questions once the browser has the saved answers. */
export function QuizApp() {
  const hydrated = useHydrated();
  if (!hydrated) return <QuizFrame step={1} editing={false} />;
  return <Quiz />;
}

function Quiz() {
  const router = useRouter();
  const [draft, setDraft] = useState<QuizDraft>(initialDraft);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [problem, setProblem] = useState<EngineProblem | null>(null);
  const [leaving, setLeaving] = useState(false);
  const asOf = todayIso();

  const step = draft.step;
  const draftRef = useRef(draft);
  const bodyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<number | undefined>(undefined);
  /** Quiz entries we pushed onto the browser history in this visit, so Back can pop them. */
  const depth = useRef(0);

  useLayoutEffect(() => {
    draftRef.current = draft;
  });

  // Every change is saved for this tab, so a refresh (or a trip away) resumes here.
  useEffect(() => {
    if (!leaving) saveDraft(draft);
  }, [draft, leaving]);

  const showStep = useCallback((next: QuizStep) => {
    window.clearTimeout(advanceTimer.current);
    setAttempted(false);
    setTouched(new Set());
    setDraft((d) => ({ ...d, step: next }));
  }, []);

  // The URL carries the step, so the phone's back gesture steps back through the quiz.
  useEffect(() => {
    window.history.replaceState(null, "", `/start?step=${draftRef.current.step}`);
    function onPop() {
      if (window.location.pathname !== "/start") return;
      const current = draftRef.current;
      const wanted = stepFromUrl() ?? 1;
      const next = clampStep(current, wanted);
      // Forward past an unanswered step: stay on the step we can show, and say so in the URL.
      if (next !== wanted) window.history.replaceState(null, "", `/start?step=${next}`);
      depth.current = Math.max(0, depth.current + (next - current.step));
      if (next !== current.step) showStep(next);
    }
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.clearTimeout(advanceTimer.current);
    };
  }, [showStep]);

  // Autofocus the step's first control whenever the step changes (and on arrival).
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const target =
      body.querySelector<HTMLElement>("[data-autofocus]") ?? body.querySelector<HTMLElement>("input, [role=switch]");
    // Text boxes take focus outright (the phone keyboard opens). Choices take it quietly, without a focus
    // ring that could read as "already chosen"; Enter and arrow keys still work from there.
    const typing = target instanceof HTMLInputElement && target.type === "text";
    target?.focus({ preventScroll: true, focusVisible: typing } as FocusOptions);
    window.scrollTo({ top: 0 });
  }, [step]);


  function goForward(next: QuizStep) {
    window.history.pushState(null, "", `/start?step=${next}`);
    depth.current += 1;
    showStep(next);
  }

  const update = useCallback((patch: Partial<QuizDraft>) => {
    setProblem(null);
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const touch = useCallback((field: string) => {
    setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
  }, []);

  function finish(d: QuizDraft) {
    // Editing your own plan keeps the payments you logged; a new plan (or one replacing the example) starts clean.
    const stored = getProfile();
    const keepLog = d.editing && stored !== null && !stored.isExample;
    const log = keepLog ? getLog() : [];
    // "Received so far" included the logged income; take it back out as the log stands now.
    const profile = draftToProfile(d, new Date(), loggedIncomeOf(log).total);
    if (!profile) {
      showStep(firstIncompleteStep(d) ?? 1);
      return;
    }
    const found = checkWithEngine(profile, log, asOf);
    if (found) {
      setProblem(found);
      if (found.step !== d.step) jumpBackTo(found.step);
      return;
    }
    setLeaving(true);
    setProfile(profile, keepLog ? undefined : { log: [] });
    clearDraft();
    router.push("/plan");
  }

  /**
   * Go back to an earlier step to fix it, keeping history in order so Back then goes to the step before
   * it. Pops the entries we pushed when there are enough; otherwise rewrites this one.
   */
  function jumpBackTo(target: QuizStep) {
    const steps = draftRef.current.step - target;
    if (steps > 0 && depth.current >= steps) {
      window.history.go(-steps); // popstate shows the step and updates depth
    } else {
      window.history.replaceState(null, "", `/start?step=${target}`);
      depth.current = 0;
      showStep(target);
    }
  }

  /** Continue: move on if this step is complete, else reveal what's wrong. */
  function next(d: QuizDraft = draftRef.current) {
    if (leaving) return;
    if (Object.keys(stepErrors(d, d.step)).length > 0) {
      setAttempted(true);
      return;
    }
    if (d.step < QUIZ_STEPS) goForward((d.step + 1) as QuizStep);
    else finish(d);
  }

  /** After a tap that answers the question outright (a filing status, a state). */
  function advanceSoon(d: QuizDraft) {
    window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => next(d), ADVANCE_DELAY_MS);
  }

  function back() {
    if (depth.current > 0) window.history.back();
    else {
      const prev = (step - 1) as QuizStep;
      window.history.replaceState(null, "", `/start?step=${prev}`);
      showStep(prev);
    }
  }

  // Enter moves on from any field. On an incomplete step it jumps to the first empty field instead.
  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || e.defaultPrevented || e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    // Text boxes, radios, checkboxes and the W-2 switch: Enter means Continue (Space still toggles).
    if (target.tagName !== "INPUT" && target.getAttribute("role") !== "switch") return;
    e.preventDefault();
    const errs = stepErrors(draftRef.current, step);
    if (errs._missing) {
      const empty = Array.from(bodyRef.current?.querySelectorAll<HTMLInputElement>('input[type="text"]') ?? []).find(
        (el) => el.value.trim() === "",
      );
      if (empty && empty !== target) {
        empty.focus();
        return;
      }
    }
    next();
  }

  // Conflicts show once a field was left or Continue was tried; "missing" never shouts at an empty field.
  const all = stepErrors(draft, step);
  const shown: StepErrors = {};
  for (const [field, message] of Object.entries(all)) {
    if (field !== "_missing" && (attempted || touched.has(field))) shown[field] = message;
  }
  const valid = Object.keys(all).length === 0;
  const missingNote = attempted && all._missing ? all._missing : null;
  const questionId = useId();

  const props: StepProps = { draft, update, errors: shown, touch, advance: advanceSoon, questionId };
  const body: Record<QuizStep, ReactNode> = {
    1: <FilingStep {...props} />,
    2: <StateStep {...props} />,
    3: <IncomeStep {...props} asOf={asOf} />,
    4: <W2Step {...props} />,
    5: <PriorYearStep {...props} />,
    6: <PaymentsStep {...props} noneYet={() => {
      const d = { ...draftRef.current, estimatedPaid: 0 };
      update({ estimatedPaid: 0 });
      next(d);
    }} />,
  };

  const primaryLabel =
    step === QUIZ_STEPS ? (draft.editing ? "Update my plan" : "See my plan") : step === 4 && !draft.hasW2 ? "Skip" : "Continue";

  return (
    <QuizFrame step={step} editing={draft.editing}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          const el = e.target;
          if (!(el instanceof HTMLInputElement) || el.type !== "text") return;
          // Wait for the keyboard to finish opening, then make room.
          window.setTimeout(() => document.activeElement === el && keepAboveBar(el, barRef.current), 350);
        }}
        className="flex flex-1 flex-col"
      >
        <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-7 pb-36 sm:flex-none sm:px-6 sm:pt-[9vh] sm:pb-0">
          <div key={step} className="animate-[pp-step-in_260ms_var(--ease-out-soft)_both]">
            <h1
              id={questionId}
              className="text-[1.625rem] leading-[2rem] font-bold tracking-[-0.02em] text-ink sm:text-[2.125rem] sm:leading-[2.5rem]"
            >
              {STEP_COPY[step].question}
            </h1>
            <p className="mt-2 text-base text-ink-2">{STEP_COPY[step].lead}</p>

            {problem && problem.step === step && (
              <p role="alert" className="mt-5 rounded-md border border-red/30 bg-red-soft px-4 py-3 text-sm text-red">
                {problem.message}
              </p>
            )}

            <div ref={bodyRef} className="mt-6 sm:mt-8">
              {body[step]}
            </div>
          </div>
        </div>

        <ActionBar barRef={barRef}>
          {missingNote && (
            <p role="status" className="mb-2 text-sm font-medium text-amber sm:order-last sm:mt-3 sm:mb-0">
              {missingNote}
            </p>
          )}
          <div className="flex items-center gap-3">
            {step === 1 ? (
              <Button
                href={draft.editing ? "/plan" : "/"}
                variant="secondary"
                size="lg"
                className="px-5"
                onClick={() => {
                  // Leaving an edit drops it: next time "Edit my answers" starts from the saved plan.
                  if (draft.editing) {
                    setLeaving(true);
                    clearDraft();
                  }
                }}
              >
                <BackIcon />
                Back
              </Button>
            ) : (
              <Button variant="secondary" size="lg" className="px-5" onClick={back}>
                <BackIcon />
                Back
              </Button>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={!valid || leaving}
              className="flex-1 sm:min-w-44 sm:flex-none"
            >
              {primaryLabel}
            </Button>
          </div>
        </ActionBar>
      </form>
    </QuizFrame>
  );
}

/** Mobile: pinned to the bottom (lifted above the iOS keyboard). Desktop: right under the question. */
function ActionBar({ children, barRef }: { children: ReactNode; barRef: Ref<HTMLDivElement> }) {
  const inset = useKeyboardInset();
  return (
    <div
      ref={barRef}
      style={{ "--kb": `${inset}px` } as CSSProperties}
      className="fixed inset-x-0 bottom-[var(--kb)] z-10 border-t border-line bg-paper/95 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:backdrop-blur-none"
    >
      <div className="mx-auto flex w-full max-w-xl flex-col px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 sm:pb-16">
        {children}
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="-ml-1 size-4 fill-none stroke-current stroke-2">
      <path d="M10 3.5 5.5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Slim top bar (home link, step count) over a six-segment progress bar. */
function QuizFrame({ step, editing, children }: { step: QuizStep; editing: boolean; children?: ReactNode }) {
  return (
    <div data-quiz className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-4 sm:h-16">
          <Link href="/" aria-label="Penaltyproof home" className="-mx-1 rounded-sm px-1 py-1">
            <Wordmark />
          </Link>
          <p className="text-sm text-ink-2" aria-live="polite">
            {editing && <span className="sr-only">Editing your answers. </span>}
            Step {step} of {QUIZ_STEPS}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={1}
          aria-valuemax={QUIZ_STEPS}
          aria-valuenow={step}
          aria-valuetext={`Step ${step} of ${QUIZ_STEPS}`}
          className="flex gap-1"
        >
          {Array.from({ length: QUIZ_STEPS }, (_, i) => (
            <span
              key={i}
              className={cx(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i < step ? "bg-accent" : "bg-line",
              )}
            />
          ))}
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
