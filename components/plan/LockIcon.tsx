/** The small padlock next to a Pro feature's heading for free users. */
export function LockIcon({ className = "size-4 text-ink-3" }: { className?: string }) {
  return (
    <svg role="img" aria-label="Pro" viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
    </svg>
  );
}

/** The "Pro" lock sticker pinned to a locked Pro card's corner. The padlock is the accessible "Pro" label.
 * Absolutely positioned: the parent must be `relative` (proCardClasses adds it). */
export function ProSticker() {
  return (
    <span className="absolute -top-4 right-4 inline-flex rotate-[3deg] items-center gap-1.5 rounded-full border-2 border-ink bg-sun px-3 py-1.5 font-mono text-[11px] leading-none font-bold tracking-[0.08em] text-ink uppercase shadow-chip sm:right-6">
      <LockIcon className="size-3.5 text-ink" />
      <span aria-hidden>Pro</span>
    </span>
  );
}

/** Frame for a Pro feature card: white once unlocked, paper with the lock sticker while locked. */
export function proCardClasses(locked: boolean): string {
  return [
    "relative min-w-0 rounded-lg border-3 border-ink px-5 py-6 shadow-hard sm:px-7 sm:py-7",
    locked ? "bg-paper" : "bg-surface",
  ].join(" ");
}

/** Check-mark bullet for the "what you get" lists on locked Pro cards. */
export function ProCheck() {
  return (
    <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-mint">
      <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 6.5 2.5 2.5L10 3" />
      </svg>
    </span>
  );
}
