"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadDraft } from "@/lib/product/quizDraft";
import { useRestoreSavedPlan } from "@/lib/product/useRestoreSavedPlan";

/**
 * /start: if this browser is empty and the server has the person's plan, put it back and go to /plan.
 * Skipped while a quiz is in progress (a saved draft), so someone answering questions is never moved.
 */
export function RestoreRedirect() {
  const router = useRouter();
  // Read once on mount: the draft is in sessionStorage, which the server render doesn't have.
  const [inProgress] = useState(() => typeof window !== "undefined" && loadDraft() !== null);
  const status = useRestoreSavedPlan({ skip: inProgress });
  useEffect(() => {
    if (status === "restored") router.replace("/plan");
  }, [status, router]);
  return null;
}
