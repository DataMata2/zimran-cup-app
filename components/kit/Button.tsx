import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "dark";
export type ButtonSize = "sm" | "md" | "lg";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width (handy for stacked mobile CTAs). */
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

/** With `href`, renders a Next.js link styled as a button. */
export type ButtonLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children"> & { href: string };

/** Without `href`, renders a <button> (type="button" unless set). */
export type ButtonButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };

export type ButtonProps = ButtonLinkProps | ButtonButtonProps;

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold select-none " +
  "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

// Filled variants: 3px ink border on a pressable ink ledge (the `press` utility in globals.css).
const variants: Record<ButtonVariant, string> = {
  primary: "press border-3 border-ink bg-sun text-ink hover:bg-[#ffdc52]",
  secondary: "press border-3 border-ink bg-surface text-ink hover:bg-sky-soft",
  /** Ink fill, white text: the one dark action on a card (e.g. pay the IRS from the past-due card). */
  dark: "press border-3 border-ink bg-ink text-white hover:bg-ink-2",
  ghost: "text-ink underline-offset-4 decoration-2 transition-colors hover:underline hover:bg-ink/5",
};

// Every size keeps a 44px+ tap target.
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-6 text-lg",
};

/** The button look for elements Button can't render, e.g. a plain <a download> to a route handler. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: Pick<CommonProps, "variant" | "size" | "fullWidth" | "className"> = {}): string {
  return cx(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

/** Primary (sun) / secondary (white) / dark (ink) / ghost (link) button in three sizes; a link when `href` is given. */
export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", fullWidth = false, className, children } = props;
  const classes = buttonClasses({ variant, size, fullWidth, className });

  if (props.href !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { variant: _v, size: _s, fullWidth: _f, className: _c, children: _ch, href, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { variant: _v, size: _s, fullWidth: _f, className: _c, children: _ch, href: _h, type = "button", ...rest } = props;
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
