// Free-tier counting. The free plan allows FREE_LOG_LIMIT "I got paid" entries ever added to the log, not
// FREE_LOG_LIMIT at a time: the store keeps a counter (pp.v1.added) that only goes up, so deleting an entry and
// adding another doesn't get round the limit. IRS payments are free and never counted: logging one is what moves
// the paid-to-IRS meter. Client-side only, like the rest of guest storage.

import type { LogEntry } from "./types";

/** "I got paid" entries in a log: the ones the free tier counts. */
export function countedEntries(log: readonly Pick<LogEntry, "kind">[]): number {
  let n = 0;
  for (const e of log) if (e.kind === "income") n += 1;
  return n;
}

/** Entries counted against the free tier: the stored counter, never fewer than the counted entries in the log now. */
export function entriesUsed(added: number, countedInLog: number): number {
  return Math.max(added, countedInLog);
}

/** The counter after one more "I got paid" entry is added. */
export function nextAdded(added: number, countedInLog: number): number {
  return entriesUsed(added, countedInLog) + 1;
}
