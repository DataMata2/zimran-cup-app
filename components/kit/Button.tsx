import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
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
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold select-none " +
  "transition-[background-color,border-color,color,transform] duration-150 ease-out-soft " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover active:bg-accent-press",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-paper",
  ghost: "text-accent hover:bg-accent-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-13 px-6 text-base",
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

/** Primary / secondary / ghost button in three sizes; a link when `href` is given. */
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
