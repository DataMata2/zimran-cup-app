// The browser's guest cookie, created once. Two requests that each create a guest when the cookie is
// missing (POST /api/guest before checkout and the first PUT /api/plan-data) must not run side by side
// on a fresh browser: each would mint its own guest id, the checkout would belong to one while the
// browser kept the other, and the return from Stripe would not find the payment. Everything that can
// create the guest waits on this one request instead.

type Fetch = typeof fetch;

/** A guest ensurer: the first call POSTs /api/guest, later calls share it. Never rejects. */
export function createGuestEnsurer(): (fetchFn: Fetch) => Promise<void> {
  let pending: Promise<void> | null = null;
  return (fetchFn) => {
    pending ??= fetchFn("/api/guest", { method: "POST" }).then(
      (res) => {
        if (!res.ok) pending = null; // try again next time
      },
      () => {
        pending = null;
      },
    );
    return pending;
  };
}

/** This page's guest ensurer. */
export const ensureGuest = createGuestEnsurer();
