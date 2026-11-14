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
  paid: "bg-accent-soft text-accent-ink",
  due: "bg-amber-soft text-amber",
  pastDue: "bg-red-soft text-red",
  upcoming: "bg-sunken text-ink-2",
};

const labels: Record<BadgeStatus, string> = {
  paid: "Paid",
  due: "Due",
  pastDue: "Past due",
  upcoming: "Upcoming",
};

const dots: Record<BadgeStatus, string> = {
  paid: "bg-accent",
  due: "bg-amber-mid",
  pastDue: "bg-red",
  upcoming: "bg-ink-3",
};

/** Status pill for a deadline. Colour is never the only signal: the label always says the status. */
export function Badge({ status, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        styles[status],
        className,
      )}
    >
      <span aria-hidden className={cx("size-1.5 rounded-full", dots[status])} />
      {children ?? labels[status]}
    </span>
  );
}
