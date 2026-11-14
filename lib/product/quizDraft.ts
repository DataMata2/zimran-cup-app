// The quiz draft in sessionStorage, so a refresh (or a trip back from /plan) doesn't lose answers.
// Per tab on purpose: a half-finished quiz isn't worth keeping across sessions; the finished profile is.

import { draftFromProfile, emptyDraft, loggedIrsOf, parseDraft, type QuizDraft } from "./quiz";
import type { LogEntry, Profile } from "./types";

/**
 * Set by `clearDraft({ block: true })`: a quiz that is still on screen while the page leaves must not save its
 * draft again. Lifted by the next `loadDraft()`, which is how a newly mounted quiz starts.
 */
let savesBlocked = false;

export const QUIZ_DRAFT_KEY = "pp.v1.quiz";

export function loadDraft(): QuizDraft | null {
  savesBlocked = false;
  try {
    return parseDraft(window.sessionStorage.getItem(QUIZ_DRAFT_KEY));
  } catch {
    return null;
  }
}

export function saveDraft(draft: QuizDraft): void {
  if (savesBlocked) return;
  try {
    window.sessionStorage.setItem(QUIZ_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked: the quiz still works for this page load.
  }
}

/** Remove the draft. With `block`, the quiz on screen can't save it again until a quiz loads one. */
export function clearDraft(options?: { block?: boolean }): void {
  if (options?.block) savesBlocked = true;
  try {
    window.sessionStorage.removeItem(QUIZ_DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * The draft a quiz opens with. A saved draft wins, except a new-quiz draft (editing: false) when this browser
 * has the person's own plan: that draft is stale (e.g. saved by the quiz just before a saved copy was restored),
 * and opening it would start a blank quiz whose finish wipes the log. Then the quiz edits the stored plan.
 * A saved edit draft gets `loggedIrs` refreshed from `log` (SHARED-01).
 */
export function chooseDraft(saved: QuizDraft | null, stored: Profile | null, log: readonly LogEntry[]): QuizDraft {
  const ownPlan = stored !== null && !stored.isExample;
  // The sum line's logged IRS total always comes from the live log, never the saved draft: an IRS
  // entry may have been deleted (or added) on /plan since the draft was saved.
  if (saved && saved.editing) return { ...saved, loggedIrs: loggedIrsOf(log) };
  if (saved && !ownPlan) return saved;
  return ownPlan ? draftFromProfile(stored, log) : emptyDraft();
}
