// The quiz draft in sessionStorage, so a refresh (or a trip back from /plan) doesn't lose answers.
// Per tab on purpose: a half-finished quiz isn't worth keeping across sessions; the finished profile is.

import { parseDraft, type QuizDraft } from "./quiz";

export const QUIZ_DRAFT_KEY = "pp.v1.quiz";

export function loadDraft(): QuizDraft | null {
  try {
    return parseDraft(window.sessionStorage.getItem(QUIZ_DRAFT_KEY));
  } catch {
    return null;
  }
}

export function saveDraft(draft: QuizDraft): void {
  try {
    window.sessionStorage.setItem(QUIZ_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked: the quiz still works for this page load.
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(QUIZ_DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}
