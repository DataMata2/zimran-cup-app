import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type CardTone = "surface" | "sunken" | "accent";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** surface = white card, ink border, hard shadow (default); sunken = a paper inset; accent = a pale sun panel. */
  tone?: CardTone;
  /** Add the hard ink shadow to a tone that has none (surface always has it). */
  raised?: boolean;
  /** Inner padding. */
  padding?: "none" | "md" | "lg";
  /** Element to render: a <section> or <article> where it carries a heading, a <div> otherwise. */
  as?: "div" | "section" | "article" | "aside";
  children: ReactNode;
}

const tones: Record<CardTone, string> = {
  surface: "bg-surface border-3 border-ink shadow-hard",
  sunken: "bg-paper border-2 border-ink",
  accent: "bg-accent-soft border-3 border-ink",
};

const paddings = { none: "", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;

/** A bordered panel: 3px ink lines, 14px radius, hard blur-free shadow. */
export function Card({ tone = "surface", raised = false, padding = "md", as: Tag = "div", className, children, ...rest }: CardProps) {
  return (
    <Tag className={cx("rounded-lg", tones[tone], paddings[padding], raised && "shadow-hard", className)} {...rest}>
      {children}
    </Tag>
  );
}
