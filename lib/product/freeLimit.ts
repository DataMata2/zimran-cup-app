// Free-tier counting. The free plan allows FREE_LOG_LIMIT entries ever added to the log, not FREE_LOG_LIMIT
// entries at a time: the store keeps a counter (pp.v1.added) that only goes up, so deleting an entry and
// adding another doesn't get round the limit. Client-side only, like the rest of guest storage.

/** Entries counted against the free tier: the stored counter, never fewer than the log holds now. */
export function entriesUsed(added: number, logLength: number): number {
  return Math.max(added, logLength);
}

/** The counter after one more entry is added. */
export function nextAdded(added: number, logLength: number): number {
  return entriesUsed(added, logLength) + 1;
}
