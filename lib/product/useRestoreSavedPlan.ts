"use client";

// Shared by /, /start and /plan: on mount, put a saved server copy back into an empty browser.

import { useEffect, useState } from "react";
import { restoreIfEmpty, type RestoreOutcome } from "./sync";

/** "checking" until the restore check is done, then its outcome (see `restoreIfEmpty`). */
export type RestoreStatus = "checking" | RestoreOutcome;

/** Run the restore check once on mount. With `skip`, nothing is fetched and the status is "local". */
export function useRestoreSavedPlan(options?: { skip?: boolean }): RestoreStatus {
  const skip = options?.skip ?? false;
  const [status, setStatus] = useState<RestoreStatus>(skip ? "local" : "checking");
  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    void restoreIfEmpty().then((outcome) => {
      if (!cancelled) setStatus(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [skip]);
  return status;
}
