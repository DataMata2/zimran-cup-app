import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type CardTone = "surface" | "sunken" | "accent";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** surface = white on paper (default); sunken = a quiet inset; accent = the soft green "safe" panel. */
  tone?: CardTone;
  /** Lift the card with the single page elevation. Use for at most one card per screen. */
  raised?: boolean;
  /** Inner padding. */
  padding?: "none" | "md" | "lg";
  /** Element to render: a <section> or <article> where it carries a heading, a <div> otherwise. */
  as?: "div" | "section" | "article" | "aside";
  children: ReactNode;
}

const tones: Record<CardTone, string> = {
  surface: "bg-surface border border-line",
  sunken: "bg-sunken border border-transparent",
  accent: "bg-accent-soft border border-accent-mid/50",
};

const paddings = { none: "", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;

/** A bordered panel. Borders do the separating; shadow only when `raised`. */
export function Card({ tone = "surface", raised = false, padding = "md", as: Tag = "div", className, children, ...rest }: CardProps) {
  return (
    <Tag className={cx("rounded-lg", tones[tone], paddings[padding], raised && "shadow-raised", className)} {...rest}>
      {children}
    </Tag>
  );
}
