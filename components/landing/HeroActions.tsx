"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/kit/Button";
import { todayIso } from "@/lib/product/asof";
import { buildExample } from "@/lib/product/example";
import { setProfile, useHydrated, useProfile } from "@/lib/product/store";
import { useRestoreSavedPlan } from "@/lib/product/useRestoreSavedPlan";

/** Load the example persona and its pre-logged payment into guest storage, then open the plan. */
function loadExample(): void {
  const { profile, entry } = buildExample(todayIso());
  setProfile(profile, { log: [entry] });
}

export function HeroActions() {
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useProfile();
  const [confirming, setConfirming] = useState(false);
  // An empty browser gets the saved copy back, which shows "Continue to my plan".
  useRestoreSavedPlan();
  const hasOwnPlan = profile !== null && !profile.isExample;

  function tryExample() {
    // Never overwrite someone's own numbers without asking.
    if (hasOwnPlan && !confirming) {
      setConfirming(true);
      return;
    }
    loadExample();
    router.push("/plan");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 min-[481px]:flex-row min-[481px]:flex-wrap">
        <Button href="/start" size="lg" fullWidth className="max-[359px]:gap-1.5 max-[359px]:px-3 max-[359px]:text-[15px] min-[481px]:w-auto">
          Get my number (no sign-up)
          <svg viewBox="0 0 22 22" aria-hidden className="size-[22px] shrink-0">
            <path
              d="M4 11h13m-5-6 6 6-6 6"
              fill="none"
              className="stroke-ink"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
        {/* Desktop: a secondary button. Phone: a text link right under the CTA. Same action. */}
        <Button variant="secondary" size="lg" className="max-[480px]:hidden" onClick={tryExample}>
          Try with an example
        </Button>
        <button
          type="button"
          onClick={tryExample}
          className="inline-flex min-h-11 items-center self-center rounded-sm px-2 text-[17px] font-bold text-ink underline decoration-2 underline-offset-4 min-[481px]:hidden"
        >
          Try with an example
        </button>
      </div>

      {confirming && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md border-2 border-ink bg-sun-soft px-4 py-3 text-sm text-ink shadow-chip sm:flex-row sm:items-center sm:justify-between"
        >
          <p>The example replaces the numbers you saved on this device.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={tryExample}>
              Replace with example
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep mine
            </Button>
          </div>
        </div>
      )}

      {hydrated && profile && (
        <Link
          href="/plan"
          className="inline-flex min-h-11 items-center self-center rounded-sm px-1 text-base font-bold text-ink underline-offset-4 hover:underline min-[481px]:self-start"
        >
          Continue to my plan →
        </Link>
      )}
    </div>
  );
}
