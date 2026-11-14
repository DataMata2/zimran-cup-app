"use client";

import { Button } from "@/components/kit/Button";
import { useHydrated, useProfile } from "@/lib/product/store";

/** The one header action: back to your plan if you have one, otherwise start the quiz ("Start" on phones). */
export function HeaderAction() {
  const hydrated = useHydrated();
  const profile = useProfile();
  if (!hydrated) return <span className="h-11 w-[84px] shrink-0 sm:w-[156px]" aria-hidden />;
  return profile ? (
    <Button href="/plan" size="sm" className="shrink-0 px-[18px] text-[15px]">
      My plan
    </Button>
  ) : (
    <Button href="/start" size="sm" className="shrink-0 px-[18px] text-[15px]">
      <span className="sm:hidden">Start</span>
      <span className="hidden sm:inline">Get my number</span>
    </Button>
  );
}
