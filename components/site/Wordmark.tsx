import { cx } from "@/components/ui/cx";

/** Four rising bars, one per quarterly deadline, the last one filled: the product's mark. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={cx("size-5", className)}>
      <rect x="1" y="12" width="3.5" height="7" rx="1" className="fill-accent/35" />
      <rect x="5.75" y="9" width="3.5" height="10" rx="1" className="fill-accent/55" />
      <rect x="10.5" y="5.5" width="3.5" height="13.5" rx="1" className="fill-accent/75" />
      <rect x="15.25" y="1" width="3.5" height="18" rx="1" className="fill-accent" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-[1.0625rem] font-bold tracking-[-0.01em] text-ink", className)}>
      <Mark />
      Penaltyproof
    </span>
  );
}
