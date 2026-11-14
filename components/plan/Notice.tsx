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
        "flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm font-medium",
        tone === "accent" ? "border-accent-mid/60 bg-accent-soft text-accent-ink" : "border-line bg-sunken text-ink-2",
        className,
      )}
    >
      <p>{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-sm px-1 py-0.5 text-sm font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}
