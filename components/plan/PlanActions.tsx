"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { resetAll } from "@/lib/product/store";

/** Edit the quiz answers, or clear everything on this device (confirmed inline). */
export function PlanActions({ isExample, className }: { isExample: boolean; className?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  function startOver() {
    resetAll();
    router.push("/start");
  }

  return (
    <section aria-label="Change your plan" className={cx("min-w-0 border-t border-line pt-8", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button href="/start" variant="secondary" className="w-full sm:w-auto">
          {isExample ? "Start with my own numbers" : "Edit my answers"}
        </Button>
        {!confirming && (
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setConfirming(true)}>
            Start over
          </Button>
        )}
      </div>
      {confirming && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-3 rounded-md border border-line-strong bg-surface px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
        >
          <p>This clears your answers and payment log on this device.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={startOver}>
              Clear and start over
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep my plan
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
