"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { SegmentedControl } from "@/components/kit/SegmentedControl";
import { FREE_LOG_LIMIT } from "@/lib/product/plan";
import { DEFAULT_PRO_PLAN, startCheckout, type ProPlan } from "@/lib/product/pro";

/** Why the sheet opened: the free log is full, the person asked for Pro, or they tried a Pro feature. */
export type PaywallReason = "limit" | "upgrade" | "screenshot" | "ask" | "annualized" | "export";

const HEADINGS: Record<PaywallReason, { title: string; body: string }> = {
  limit: {
    title: `You've used your ${FREE_LOG_LIMIT} free entries`,
    body: "Pro keeps logging every payment, so your set-aside and meter stay right through April.",
  },
  upgrade: { title: "Penaltyproof Pro", body: "Log every payment for the whole tax year, and more." },
  screenshot: {
    title: "Read payouts from a screenshot",
    body: "With Pro, upload a payout screenshot and we fill in the amount, client and date for you to check.",
  },
  ask: {
    title: "Ask about your numbers",
    body: "With Pro, ask why a payment is what it is and get an answer from your own plan.",
  },
  annualized: {
    title: "Paid unevenly? See your annualized plan",
    body: "With Pro, see your instalments under the IRS annualized method (Form 2210 Schedule AI), next to the regular schedule.",
  },
  export: {
    title: "Export for your accountant",
    body: "With Pro, download your payment log, instalments and tax breakdown as a CSV file.",
  },
};

const PRICES: Record<ProPlan, { price: string; per: string; cta: string }> = {
  yearly: { price: "$59", per: "per tax year, through the April 15, 2027 return", cta: "Continue to checkout, $59" },
  monthly: { price: "$9.99", per: "a month", cta: "Continue to checkout, $9.99 a month" },
};

const PLAN_OPTIONS = [
  { value: "yearly", label: "Tax year" },
  { value: "monthly", label: "Monthly" },
] as const;

const FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Your plan, deadlines and calendar file", free: true, pro: true },
  { label: "Payment log", free: `${FREE_LOG_LIMIT} entries`, pro: "Unlimited" },
  { label: "Read payouts from a screenshot", free: false, pro: true },
  { label: "Annualized plan for uneven income", free: false, pro: true },
  { label: "“Ask why” chat", free: false, pro: true },
  { label: "CSV export for your accountant", free: false, pro: true },
];

function Cell({ value, pro }: { value: string | boolean; pro?: boolean }) {
  if (typeof value === "string") {
    return <span className={cx("text-sm font-semibold", pro ? "text-accent-ink" : "text-ink-2")}>{value}</span>;
  }
  return value ? (
    <svg role="img" aria-label="Included" viewBox="0 0 16 16" className={cx("size-4", pro ? "text-accent" : "text-ink-2")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  ) : (
    <span role="img" aria-label="Not included" className="block h-0.5 w-3 rounded-full bg-line-strong" />
  );
}

/** The Pro sheet: plan comparison, price toggle and checkout. A bottom sheet on phones, a dialog on desktop. */
export function Paywall({ reason, onClose }: { reason: PaywallReason | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [plan, setPlan] = useState<ProPlan>(DEFAULT_PRO_PLAN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = reason !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Back from Stripe via the back button, the page can come out of the back/forward cache with the
  // button still busy. Reset it so checkout can be started again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function checkout() {
    setBusy(true);
    setError(null);
    const out = await startCheckout(plan);
    // On success the browser is leaving for Stripe; keep the button busy until it does.
    if (!out.ok) {
      setError(out.error);
      setBusy(false);
    }
  }

  const price = PRICES[plan];

  return (
    <dialog
      ref={ref}
      aria-labelledby="paywall-title"
      onClose={onClose}
      onClick={(e) => {
        // A tap on the backdrop (the dialog element itself, outside the panel) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cx(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-lg bg-surface p-0 text-ink",
        "backdrop:bg-ink/45 sm:m-auto sm:max-w-lg sm:rounded-lg",
        "open:animate-[pp-step-in_250ms_var(--ease-out-soft)_both]",
      )}
    >
      <div className="px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-7 sm:pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="paywall-title" className="text-xl font-bold tracking-[-0.015em] text-ink">
              {HEADINGS[reason ?? "upgrade"].title}
            </h2>
            <p className="mt-1.5 text-sm text-ink-2">
              {HEADINGS[reason ?? "upgrade"].body}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>


        <div className="mt-5">
          <SegmentedControl options={PLAN_OPTIONS} value={plan} onChange={setPlan} aria-label="Billing" fullWidth />
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-3xl font-bold tracking-[-0.02em] text-ink">{price.price}</span>
            <span className="text-sm text-ink-2">{price.per}</span>
            {plan === "yearly" && (
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">Best value</span>
            )}
          </p>
        </div>

        <Button size="lg" fullWidth className="mt-5" onClick={checkout} disabled={busy} aria-busy={busy}>
          {busy ? "Opening checkout…" : price.cta}
        </Button>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-ink-3">Demo: use test card 4242 4242 4242 4242, any future date, any CVC.</p>

        <table className="mt-6 w-full border-collapse text-left">
          <caption className="sr-only">Free and Pro compared</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 text-xs font-semibold text-ink-3">
                <span className="sr-only">Feature</span>
              </th>
              <th scope="col" className="w-20 py-2 text-center text-xs font-semibold text-ink-3">Free</th>
              <th scope="col" className="w-24 py-2 text-center text-xs font-semibold text-accent-ink">Pro</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.label} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-2 pr-2 text-sm font-normal text-ink">{f.label}</th>
                <td className="py-2 text-center"><span className="inline-flex justify-center"><Cell value={f.free} /></span></td>
                <td className="bg-accent-soft/50 py-2 text-center"><span className="inline-flex justify-center"><Cell value={f.pro} pro /></span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <Button variant="ghost" fullWidth className="mt-3" onClick={onClose}>
          Not now
        </Button>
      </div>
    </dialog>
  );
}
