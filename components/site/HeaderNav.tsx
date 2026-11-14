"use client";

import { usePathname } from "next/navigation";

/** Desktop-only in-page link to the landing's "How it works" section; shown on the landing page only. */
export function HeaderNav() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return (
    <nav aria-label="Page" className="hidden md:block">
      <a
        href="#how-it-works"
        className="inline-flex min-h-11 items-center rounded-sm px-2 font-medium text-ink decoration-2 underline-offset-4 hover:underline"
      >
        How it works
      </a>
    </nav>
  );
}
