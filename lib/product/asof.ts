// "Today" for the engine: the browser's local date, clamped to the range the engine accepts.

/** First day the engine accepts as `asOf`. */
export const ASOF_MIN = "2026-01-01";
/** Last day the engine accepts as `asOf` (the 2026 return due date). */
export const ASOF_MAX = "2027-04-15";

/** Local calendar date of `now` as YYYY-MM-DD (not UTC, so late evenings don't jump a day). */
export function localIsoDate(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's local date as YYYY-MM-DD, clamped to ASOF_MIN..ASOF_MAX. ISO dates compare as strings. */
export function todayIso(now: Date = new Date()): string {
  const iso = localIsoDate(now);
  if (iso < ASOF_MIN) return ASOF_MIN;
  if (iso > ASOF_MAX) return ASOF_MAX;
  return iso;
}
