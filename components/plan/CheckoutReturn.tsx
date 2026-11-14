"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { refreshPro } from "@/lib/product/pro";

export type CheckoutNotice = "pro" | "cancelled";

/**
 * Reads the Stripe return parameters (?pro=1 after paying, ?checkout=cancelled after backing out),
 * reports a notice and strips the parameter from the URL. Renders nothing; wrap it in <Suspense>.
 */
export function CheckoutReturn({ onNotice }: { onNotice: (notice: CheckoutNotice) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef<string | null>(null);
  const paid = params.get("pro") === "1";
  const cancelled = params.get("checkout") === "cancelled";

  useEffect(() => {
    if (!paid && !cancelled) return;
    const key = params.toString();
    if (handled.current === key) return;
    handled.current = key;
    const strip = () => router.replace(pathname, { scroll: false });

    if (cancelled) {
      onNotice("cancelled");
      strip();
      return;
    }
    void refreshPro().then((pro) => {
      if (pro) onNotice("pro");
      strip();
    });
  }, [paid, cancelled, params, pathname, router, onNotice]);

  return null;
}
