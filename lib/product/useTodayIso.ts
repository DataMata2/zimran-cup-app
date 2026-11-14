// "Today" as a React value: null on the server and during hydration, the clamped local date after.
// The engine needs asOf from the browser's clock, so results are computed client-side.

import { useSyncExternalStore } from "react";
import { todayIso } from "./asof";

const noopSubscribe = () => () => {};

/** Clamped local date (see `todayIso`), or null until the component runs in the browser. */
export function useTodayIso(): string | null {
  return useSyncExternalStore(noopSubscribe, () => todayIso(), () => null);
}
