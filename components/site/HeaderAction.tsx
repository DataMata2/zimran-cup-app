"use client";

import { Button } from "@/components/ui/Button";
import { useHydrated, useProfile } from "@/lib/product/store";

/** The one header action: back to your plan if you have one, otherwise start the quiz. */
export function HeaderAction() {
  const hydrated = useHydrated();
  const profile = useProfile();
  if (!hydrated) return <span className="h-9 w-32" aria-hidden />;
  return profile ? (
    <Button href="/plan" variant="secondary" size="sm">
      My plan
    </Button>
  ) : (
    <Button href="/start" variant="secondary" size="sm">
      Get my number
    </Button>
  );
}
