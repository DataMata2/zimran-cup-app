// Client sync with the server copy (/api/plan-data). localStorage stays the source of truth on this device:
// - on mount of /, /start and /plan, an empty browser gets a real (non-example) server copy back; local wins
//   whenever it has anything;
// - on /plan, after any store change a PUT goes out 1 s later (debounced). A pending one is sent right away
//   when the page is hidden or closed, or the plan page unmounts;
// - the example persona is never sent, and only an explicit "Start over" clears the copy;
// - if the restore check could not reach the server, nothing is sent for the rest of that page session.
// Every failure is silent for the person and logged to the console only.

import { ensureGuest } from "./guestClient";
import { clearedBody, isLocalEmpty, parsePlanData, shouldRestore, syncBody, type PlanData } from "./planData";
import { getPlanSnapshot, onStoreChange, restorePlan } from "./store";

export const SYNC_DEBOUNCE_MS = 1_000;
const URL_ = "/api/plan-data";

export interface SyncDeps {
  fetch: typeof fetch;
  snapshot: typeof getPlanSnapshot;
  restore: typeof restorePlan;
  onChange: typeof onStoreChange;
  /** Run `flush` when the page is hidden or being unloaded. Returns the unsubscribe function. */
  onPageHide: (flush: () => void) => () => void;
  warn: (message: string, detail?: unknown) => void;
}

function browserPageHide(flush: () => void): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

const browserDeps = (): SyncDeps => ({
  // A save may create the guest: wait for the one guest request so it never mints a second id (./guestClient).
  fetch: (input, init) => (init?.method === "PUT" ? ensureGuest(fetch) : Promise.resolve()).then(() => fetch(input, init)),
  snapshot: getPlanSnapshot,
  restore: restorePlan,
  onChange: onStoreChange,
  onPageHide: browserPageHide,
  warn: (m, d) => console.warn(m, d ?? ""),
});

/**
 * - local: this browser has a plan, nothing was fetched.
 * - restored: the server copy was put back.
 * - none: the server has nothing to restore (or restoring is off after "Start over").
 * - failed: the server could not be asked; don't sync in this page session.
 */
export type RestoreOutcome = "local" | "restored" | "none" | "failed";

/** Set by "Start over" so the old copy isn't restored before the clearing PUT lands. Lives for the tab. */
let restoreSuppressed = false;

/** If this browser has no plan, fetch the server copy and restore it. Never rejects. */
export async function restoreIfEmpty(deps: SyncDeps = browserDeps()): Promise<RestoreOutcome> {
  if (!isLocalEmpty(deps.snapshot())) return "local";
  if (restoreSuppressed) return "none";
  try {
    const res = await deps.fetch(URL_, { cache: "no-store" });
    if (!res.ok) {
      deps.warn(`Checking the saved copy failed (${res.status}).`);
      return "failed";
    }
    const body = (await res.json()) as { data?: unknown };
    const server: PlanData | null = body.data == null ? null : parsePlanData(body.data);
    // Check again: the person may have started a plan while the request was in flight.
    const local = deps.snapshot();
    if (!isLocalEmpty(local)) return "local";
    if (!shouldRestore(local, server)) return "none";
    deps.restore(server);
    return "restored";
  } catch (err) {
    deps.warn("Checking the saved copy failed:", err instanceof Error ? err.message : err);
    return "failed";
  }
}

/**
 * keepalive only for sends made while the page is going (hide, unload, unmount, Start over), so they outlive
 * it. Debounced saves don't use it (browsers cap keepalive bodies in flight); one aborted by a full reload is
 * sent again by the next /plan mount, which always saves once.
 */
function put(deps: SyncDeps, body: string, keepalive: boolean, onFail: () => void): void {
  deps
    .fetch(URL_, { method: "PUT", headers: { "content-type": "application/json" }, body, keepalive })
    .then((res) => {
      if (!res.ok) {
        onFail();
        deps.warn(`Saving a copy failed (${res.status}).`);
      }
    })
    .catch((err: unknown) => {
      onFail();
      deps.warn("Saving a copy failed:", err instanceof Error ? err.message : err);
    });
}

/**
 * Keep the server copy up to date: a PUT 1 s after the last store change (and once after start when this
 * browser has a plan). Returns the stop function, which sends a pending save right away.
 */
export function startSync(deps: SyncDeps = browserDeps()): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSent: string | null = null;

  const send = (keepalive: boolean) => {
    timer = null;
    const body = syncBody(deps.snapshot());
    if (body === null || body === lastSent) return;
    lastSent = body;
    put(deps, body, keepalive, () => (lastSent = null));
  };

  const flush = () => {
    if (!timer) return;
    clearTimeout(timer);
    send(true);
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => send(false), SYNC_DEBOUNCE_MS);
  };

  const unsubscribe = deps.onChange(schedule);
  const unhide = deps.onPageHide(flush);
  if (syncBody(deps.snapshot()) !== null) schedule();

  return () => {
    unsubscribe();
    unhide();
    flush();
  };
}

/**
 * "Start over": clear the server copy too (only for a real plan; the example never reached the server), and
 * stop restoring for this tab so the old copy can't come back before the clearing PUT lands. Call it before
 * clearing local storage.
 */
export function clearSavedCopy(deps: SyncDeps = browserDeps()): void {
  restoreSuppressed = true;
  const body = clearedBody(deps.snapshot());
  if (body !== null) put(deps, body, true, () => {});
}

/** Test hook: forget the "Start over" flag. */
export function resetSyncStateForTests(): void {
  restoreSuppressed = false;
}
