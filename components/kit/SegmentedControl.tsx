"use client";

import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group (there is no visible legend inside the control). */
  "aria-label": string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
}

/**
 * A radio group drawn as chunky pressable tiles; the selected one is sun. Arrow keys move and select, as in a native radio group; only the
 * selected segment is in the tab order.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  size = "md",
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(
        // pb leaves room for the tiles' 5px pressable ledge.
        "inline-flex gap-2 pb-1.5",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map((option, i) => {
        const checked = i === selected;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              "press rounded-md border-3 border-ink px-4 font-bold whitespace-nowrap text-ink",
              size === "sm" ? "min-h-11 text-sm" : "min-h-12 text-base",
              fullWidth && "flex-1",
              checked ? "bg-sun" : "bg-surface hover:bg-sky-soft",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
