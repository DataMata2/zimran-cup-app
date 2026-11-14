import type { InstallmentStatus } from "@/lib/tax";
import { cx } from "./cx";

export type BadgeStatus = InstallmentStatus;

export interface BadgeProps {
  /** Mirrors the engine's instalment status. */
  status: BadgeStatus;
  /** Override the default label ("Paid", "Due", "Past due", "Upcoming"). */
  children?: string;
  className?: string;
}

const styles: Record<BadgeStatus, string> = {
  paid: "bg-mint",
  due: "bg-sun",
  pastDue: "bg-hot",
  upcoming: "bg-sun-soft",
};

const labels: Record<BadgeStatus, string> = {
  paid: "Paid",
  due: "Due",
  pastDue: "Past due",
  upcoming: "Upcoming",
};

/**
 * Status chip for a deadline: 2px ink border, ink text on mint (paid), sun (due, upcoming) or hot (past due).
 * Colour is never the only signal: the label always says the status.
 */
export function Badge({ status, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-1 font-mono text-[11px] leading-none font-bold tracking-[0.08em] whitespace-nowrap text-ink uppercase",
        styles[status],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-ink" />
      {children ?? labels[status]}
    </span>
  );
}
