"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { streamText, type PlanBody } from "@/lib/product/aiClient";

type State =
  | { status: "idle" }
  | { status: "loading"; key: string }
  | { status: "streaming" | "done"; key: string; text: string }
  | { status: "error"; key: string };

/**
 * "Why this number?": a plain-English explanation of the plan, written by the model from the numbers the
 * engine computed (the server recomputes them; the model only explains). Collapsed by default; opening it
 * streams the explanation once per set of numbers.
 */
export function WhyCard({ plan, className }: { plan: PlanBody; className?: string }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });
  const abort = useRef<AbortController | null>(null);
  const key = JSON.stringify(plan);

  useEffect(() => () => abort.current?.abort(), []);

  async function load() {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const k = key;
    setState({ status: "loading", key: k });
    try {
      const text = await streamText("/api/explain", plan, (t) => setState({ status: "streaming", key: k, text: t }), ctrl.signal);
      setState({ status: "done", key: k, text });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      console.error("Explain failed:", err);
      setState({ status: "error", key: k });
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && state.status === "idle") void load();
  }

  const stale = state.status !== "idle" && state.key !== key;

  return (
    <section aria-label="Why this number" className={cx("min-w-0", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="group inline-flex items-center gap-2 rounded-md text-base font-semibold text-accent underline-offset-4 hover:underline"
      >
        Why this number?
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={cx("size-4 transition-transform duration-200 ease-out-soft", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <div id={panelId} hidden={!open} className="mt-4">
        <div className="max-w-[62ch] rounded-lg border border-line bg-surface px-5 py-5 sm:px-6">
          {state.status === "error" ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-base text-ink-2">Couldn&rsquo;t load the explanation.</p>
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : state.status === "loading" || state.status === "idle" ? (
            <div aria-busy className="flex flex-col gap-2.5" role="status">
              <span className="sr-only">Writing the explanation…</span>
              {["w-full", "w-11/12", "w-full", "w-4/6"].map((w, i) => (
                <span key={i} aria-hidden className={cx("h-4 rounded-sm bg-sunken motion-safe:animate-pulse", w)} />
              ))}
            </div>
          ) : (
            <>
              <p
                aria-live="polite"
                aria-busy={state.status === "streaming"}
                className={cx("text-base leading-relaxed text-ink", stale && "text-ink-3")}
              >
                {state.text}
              </p>
              {stale ? (
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-sm text-ink-2">Your numbers changed since this was written.</p>
                  <Button size="sm" variant="secondary" onClick={() => void load()}>
                    Explain the new numbers
                  </Button>
                </div>
              ) : (
                state.status === "done" && (
                  <p className="mt-4 text-xs text-ink-3">
                    Written by AI from the numbers on this page. It explains them; it doesn&rsquo;t calculate them.
                  </p>
                )
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
