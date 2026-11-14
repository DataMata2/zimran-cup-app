import { cx } from "@/components/kit/cx";

/** A sun shield with an ink check: penalty-proof. The product's mark. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" aria-hidden className={cx("size-[1.35em] shrink-0", className)}>
      <path
        d="M17 2 31 7v10c0 8-6 13-14 15C9 30 3 25 3 17V7z"
        className="fill-sun stroke-ink"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d="m10 17 5 5 9-10"
        fill="none"
        className="stroke-ink"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// cx does not merge classes, so the default size steps aside when the caller sets one (e.g. the footer).
const SIZE_CLASS = /(^|\s)(\w+:)?text-(xs|sm|base|lg|\d?xl|\[)/;

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-[0.35em] font-display leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap text-ink",
        !SIZE_CLASS.test(className ?? "") && "text-[1.3125rem] sm:text-2xl",
        className,
      )}
    >
      <Mark />
      Penaltyproof
    </span>
  );
}
