import { cx } from "./cx";

/** The required line wherever a tax number is shown. */
export const DISCLAIMER_TEXT = "Estimate for tax year 2026, not tax advice.";

export function Disclaimer({ className }: { className?: string }) {
  return <p className={cx("font-mono text-xs font-medium tracking-[0.04em] text-ink-3", className)}>{DISCLAIMER_TEXT}</p>;
}
