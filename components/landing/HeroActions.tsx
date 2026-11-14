"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/kit/Button";
import { todayIso } from "@/lib/product/asof";
import { buildExample } from "@/lib/product/example";
import { setProfile, useHydrated, useProfile } from "@/lib/product/store";

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button href="/start" size="lg" fullWidth className="sm:w-auto">
          Get my number (no sign-up)
        </Button>
        <Button variant="secondary" size="lg" fullWidth className="sm:w-auto" onClick={tryExample}>
          Try with an example
        </Button>
      </div>

      {confirming && (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-amber-mid/60 bg-amber-soft px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
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
          className="self-start rounded-sm py-1 text-base font-semibold text-accent underline-offset-4 hover:underline"
        >
          Continue to my plan →
        </Link>
      )}
    </div>
  );
}
