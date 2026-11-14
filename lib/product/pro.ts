// Pro adapter (client side). The truth about Pro lives on the server (GET /api/pro); the store's
// pp.v1.pro flag is only a cache so the page knows right away. Checkout goes through POST /api/checkout.

import { ensureGuest } from "./guestClient";
import { isPro, setPro } from "./store";

export type ProPlan = "yearly" | "monthly";
export const DEFAULT_PRO_PLAN: ProPlan = "yearly";

export const CHECKOUT_ERROR = "Checkout is unavailable right now. Try again in a minute.";

interface Deps {
  fetch: typeof fetch;
  /** Create the guest cookie, shared with the plan sync so only one guest id is minted (./guestClient). */
  ensureGuest?: (fetchFn: typeof fetch) => Promise<unknown>;
  /** Send the browser to the checkout page. */
  navigate: (url: string) => void;
}

const browserDeps = (): Deps => ({
  fetch: (...args) => fetch(...args),
  ensureGuest,
  navigate: (url) => window.location.assign(url),
});

/**
 * Start Stripe checkout for `plan`: make sure the guest cookie exists, ask the server for a checkout URL,
 * then go there. Resolves `{ ok: true }` once the browser is on its way, or `{ ok: false, error }` with the
 * message to show inline.
 */
export async function startCheckout(
  plan: ProPlan = DEFAULT_PRO_PLAN,
  deps: Deps = browserDeps(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Idempotent; checkout would create the guest itself, so a failure here is not fatal.
    await (deps.ensureGuest ? deps.ensureGuest(deps.fetch) : deps.fetch("/api/guest", { method: "POST" })).catch(() => null);
    const res = await deps.fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const body = (await res.json().catch(() => null)) as { url?: unknown } | null;
    if (!res.ok || typeof body?.url !== "string" || !/^https?:\/\//.test(body.url)) {
      return { ok: false, error: CHECKOUT_ERROR };
    }
    deps.navigate(body.url);
    return { ok: true };
  } catch {
    return { ok: false, error: CHECKOUT_ERROR };
  }
}

/**
 * Ask the server whether this guest is Pro and cache the answer. If the server can't be reached the cached
 * value stays. Resolves to the Pro status the page should use.
 */
export async function refreshPro(deps: Pick<Deps, "fetch"> = browserDeps()): Promise<boolean> {
  try {
    const res = await deps.fetch("/api/pro", { cache: "no-store" });
    if (!res.ok) return isPro();
    const body = (await res.json()) as { pro?: unknown };
    if (typeof body.pro !== "boolean") return isPro();
    if (body.pro !== isPro()) setPro(body.pro);
    return body.pro;
  } catch {
    return isPro();
  }
}
