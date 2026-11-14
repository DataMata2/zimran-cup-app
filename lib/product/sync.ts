// Client sync with the server copy (/api/plan-data). localStorage stays the source of truth on this device:
// - on /plan mount, an empty browser gets the server copy back (local wins whenever it has anything);
// - after any store change, a PUT goes out 1 s later (debounced), and a pending one is sent on unmount.
// Every failure is silent for the person and logged to the console only.

import { parsePlanData, shouldRestore, type PlanData } from "./planData";
import { getPlanSnapshot, onStoreChange, restorePlan } from "./store";

export const SYNC_DEBOUNCE_MS = 1_000;

export interface SyncDeps {
  fetch: typeof fetch;
  snapshot: typeof getPlanSnapshot;
  restore: typeof restorePlan;
  onChange: typeof onStoreChange;
  warn: (message: string, detail?: unknown) => void;
}

const browserDeps = (): SyncDeps => ({
  fetch: (...args) => fetch(...args),
  snapshot: getPlanSnapshot,
  restore: restorePlan,
  onChange: onStoreChange,
  warn: (m, d) => console.warn(m, d ?? ""),
});

/**
 * If this browser has no plan, fetch the server copy and restore it. Resolves true when something was
 * restored. Never rejects.
 */
export async function restoreIfEmpty(deps: SyncDeps = browserDeps()): Promise<boolean> {
  if (!shouldRestoreLocal(deps)) return false;
  try {
    const res = await deps.fetch("/api/plan-data", { cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { data?: unknown };
    const server: PlanData | null = body.data == null ? null : parsePlanData(body.data);
    // Check again: the person may have started a plan while the request was in flight.
    const local = deps.snapshot();
    if (!shouldRestore(local, server)) return false;
    deps.restore(server);
    return true;
  } catch (err) {
    deps.warn("Restoring the saved copy failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

function shouldRestoreLocal(deps: SyncDeps): boolean {
  const { profile, log } = deps.snapshot();
  return profile === null && log.length === 0;
}

/**
 * Save the server copy 1 s after the last store change (and once `SYNC_DEBOUNCE_MS` after start when this
 * browser has a plan). Returns the stop function, which sends a pending save right away.
 */
export function startSync(deps: SyncDeps = browserDeps()): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSent: string | null = null;

  const send = (keepalive: boolean) => {
    timer = null;
    const { profile, log, added } = deps.snapshot();
    const body = JSON.stringify({ profile, log, added });
    if (body === lastSent) return;
    lastSent = body;
    deps
      .fetch("/api/plan-data", { method: "PUT", headers: { "content-type": "application/json" }, body, keepalive })
      .then((res) => {
        if (!res.ok) {
          lastSent = null;
          deps.warn(`Saving a copy failed (${res.status}).`);
        }
      })
      .catch((err: unknown) => {
        lastSent = null;
        deps.warn("Saving a copy failed:", err instanceof Error ? err.message : err);
      });
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => send(false), SYNC_DEBOUNCE_MS);
  };

  const unsubscribe = deps.onChange(schedule);
  if (deps.snapshot().profile !== null) schedule();

  return () => {
    unsubscribe();
    if (timer) {
      clearTimeout(timer);
      send(true);
    }
  };
}
