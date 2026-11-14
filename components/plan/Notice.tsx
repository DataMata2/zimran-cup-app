import type { ReactNode } from "react";
import { cx } from "@/components/kit/cx";

/** A one-line status note with a dismiss button (checkout results). */
export function Notice({
  tone,
  children,
  onDismiss,
  className,
}: {
  tone: "accent" | "quiet";
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cx(
        "flex items-center justify-between gap-4 rounded-md border-2 border-ink py-2 pr-2 pl-4 text-sm font-medium text-ink shadow-chip",
        tone === "accent" ? "bg-mint-soft" : "bg-surface",
        className,
      )}
    >
      <p>{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex min-h-11 shrink-0 items-center rounded-sm px-2 text-sm font-bold text-ink underline decoration-2 underline-offset-4 hover:bg-ink/5"
      >
        Dismiss
      </button>
    </div>
  );
}
