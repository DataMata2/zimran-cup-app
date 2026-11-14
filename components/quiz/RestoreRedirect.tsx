"use client";

import { useEffect, useState } from "react";
import { clearDraft, loadDraft } from "@/lib/product/quizDraft";
import { useRestoreSavedPlan } from "@/lib/product/useRestoreSavedPlan";

/**
 * /start: if this browser is empty and the server has the person's plan, put it back and go to /plan.
 * Skipped while a quiz is in progress (a saved draft), so someone answering questions is never moved.
 */
export function RestoreRedirect() {
  // Read once on mount: the draft is in sessionStorage, which the server render doesn't have.
  const [inProgress] = useState(() => typeof window !== "undefined" && loadDraft() !== null);
  const status = useRestoreSavedPlan({ skip: inProgress });
  useEffect(() => {
    if (status !== "restored") return;
    // The quiz on screen already saved a blank new-quiz draft; drop it (and stop it saving again) so the
    // next "Edit my answers" opens the restored plan, not an empty quiz.
    clearDraft({ block: true });
    // A full navigation, not router.replace: with cacheComponents, Next keeps this route's components alive in
    // <Activity> and would show the same blank quiz again on the next "Edit my answers".
    window.location.replace("/plan");
  }, [status]);
  return null;
}
