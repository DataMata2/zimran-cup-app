import { cx } from "./cx";

/** The required line wherever a tax number is shown. */
export const DISCLAIMER_TEXT = "Estimate for tax year 2026, not tax advice.";

export function Disclaimer({ className }: { className?: string }) {
  return <p className={cx("text-sm font-medium text-ink-2", className)}>{DISCLAIMER_TEXT}</p>;
}
