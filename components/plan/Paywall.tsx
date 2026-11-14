"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { FREE_LOG_LIMIT } from "@/lib/product/plan";
import { DEFAULT_PRO_PLAN, startCheckout, type ProPlan } from "@/lib/product/pro";

/** Why the sheet opened: the free log is full, the person asked for Pro, or they tried a Pro feature. */
export type PaywallReason = "limit" | "upgrade" | "screenshot" | "ask" | "annualized" | "export";

const HEADINGS: Record<PaywallReason, { title: string; body: string }> = {
  limit: {
    title: `You've logged your ${FREE_LOG_LIMIT} free client payments`,
    body: "Pro logs every client payment, so your set-aside stays right through April. Logging IRS payments stays free.",
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
  yearly: { price: "$59", per: "a year, a yearly subscription billed by Stripe (test mode)", cta: "Continue to checkout, $59 a year" },
  monthly: { price: "$9.99", per: "a month, a monthly subscription billed by Stripe (test mode)", cta: "Continue to checkout, $9.99 a month" },
};

const PLAN_OPTIONS = [
  { value: "yearly", label: "Yearly" },
  { value: "monthly", label: "Monthly" },
] as const;

const FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Your plan, deadlines and calendar file", free: true, pro: true },
  { label: "Log client payments", free: `${FREE_LOG_LIMIT} payments`, pro: "Unlimited" },
  { label: "Log IRS payments", free: true, pro: true },
  { label: "Read payouts from a screenshot", free: false, pro: true },
  { label: "Annualized plan for uneven income", free: false, pro: true },
  { label: "“Ask why” chat", free: false, pro: true },
  { label: "CSV export for your accountant", free: false, pro: true },
];

function Cell({ value, pro }: { value: string | boolean; pro?: boolean }) {
  if (typeof value === "string") {
    return <span className={cx("font-mono text-xs font-bold", pro ? "text-ink" : "text-ink-2")}>{value}</span>;
  }
  return value ? (
    <span className="inline-grid size-7 place-items-center rounded-full border-2 border-ink bg-mint">
      <svg role="img" aria-label="Included" viewBox="0 0 12 12" className="size-3 text-ink" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6.5l2.5 2.5L10 3" />
      </svg>
    </span>
  ) : (
    <span role="img" aria-label="Not included" className="block h-0.5 w-3 rounded-full bg-ink-3" />
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
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-lg border-3 border-b-0 border-ink bg-surface p-0 text-ink",
        "backdrop:bg-ink/45 sm:m-auto sm:max-w-lg sm:rounded-lg sm:border-b-3 sm:shadow-hard lg:max-w-5xl",
        "open:animate-[pp-step-in_250ms_var(--ease-out-soft)_both]",
      )}
    >
      <div className="px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-7 sm:pt-7 lg:px-10 lg:pt-9 lg:pb-9">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="paywall-title"
              className="font-display text-[1.625rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-ink sm:text-3xl lg:text-[2.5rem]"
            >
              {HEADINGS[reason ?? "upgrade"].title}
            </h2>
            <p className="mt-2 max-w-[60ch] text-[0.9375rem] leading-snug text-ink-2 lg:text-base">
              {HEADINGS[reason ?? "upgrade"].body}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface text-ink hover:bg-sky-soft"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid gap-6 lg:mt-7 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
          <div className="min-w-0">
            <fieldset>
              <legend className="sr-only">Billing</legend>
              <div className="grid grid-cols-2 gap-3 pt-2.5 pb-1.5">
                {PLAN_OPTIONS.map((o) => {
                  const checked = plan === o.value;
                  return (
                    <label
                      key={o.value}
                      className={cx(
                        "relative flex min-h-[5.25rem] cursor-pointer flex-col justify-between gap-2 rounded-md border-3 border-ink px-3.5 pt-3 pb-3 text-ink max-[359px]:px-3 transition-[background-color,box-shadow,transform]",
                        "has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-ink",
                        checked ? "bg-sun-pale shadow-[0_5px_0_var(--color-ink)]" : "bg-surface [@media(hover:hover)]:hover:bg-sky-soft",
                      )}
                    >
                      <input
                        type="radio"
                        name="paywall-plan"
                        value={o.value}
                        checked={checked}
                        onChange={() => setPlan(o.value)}
                        className="sr-only"
                      />
                      {o.value === "yearly" && (
                        <span className="absolute -top-3 right-2.5 rounded-full border-2 border-ink bg-sun px-2 py-0.5 font-mono text-[0.6875rem] leading-tight font-bold tracking-[0.08em] uppercase">
                          Best value
                        </span>
                      )}
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full border-3 border-ink bg-surface">
                          {checked && <span className="size-2 rounded-full bg-ink" />}
                        </span>
                        <span className="font-display text-lg leading-none font-extrabold tracking-[-0.02em]">{o.label}</span>
                      </span>
                      <span className="font-display text-[1.75rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
                        {PRICES[o.value].price}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <p className="mt-3 text-sm leading-snug text-ink-2">
              <span className="font-bold text-ink tabular-nums">{price.price}</span> {price.per}
            </p>

            <Button size="lg" fullWidth className="mt-4 text-center text-balance whitespace-normal! max-sm:px-5 sm:px-8 max-sm:py-2 max-sm:text-[1.0625rem] max-sm:leading-tight" onClick={checkout} disabled={busy} aria-busy={busy}>
              {busy ? "Opening checkout…" : price.cta}
            </Button>
            {error && (
              <p role="alert" className="mt-3 text-sm font-medium text-red">
                {error}
              </p>
            )}
            <p className="mt-4 flex items-start gap-2.5 rounded-[10px] border-2 border-ink bg-sky-soft px-3.5 py-3 text-sm leading-snug text-ink">
              <svg aria-hidden viewBox="0 0 22 22" className="mt-px size-5 shrink-0" fill="none">
                <rect x="2" y="5" width="18" height="13" rx="2.5" fill="#fff" stroke="currentColor" strokeWidth="2.2" />
                <path d="M2 9h18" stroke="currentColor" strokeWidth="2.2" />
              </svg>
              <span>
                Demo: use test card <span className="font-mono font-bold whitespace-nowrap">4242 4242 4242 4242</span>, any future
                date, any CVC.
              </span>
            </p>
          </div>

          <div className="min-w-0">
            <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border-3 border-ink text-left">
              <caption className="sr-only">Free and Pro compared</caption>
              <thead>
                <tr className="bg-ink text-white">
                  <th scope="col" className="px-3 py-2.5">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col" className="w-18 border-l-2 border-ink px-2 py-2.5 text-center font-mono text-xs font-bold tracking-[0.08em] uppercase">Free</th>
                  <th scope="col" className="w-22 border-l-2 border-ink px-2 py-2.5 text-center font-mono text-xs font-bold tracking-[0.08em] uppercase">Pro</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f) => (
                  <tr key={f.label} className="[&:last-child>*]:border-b-0">
                    <th scope="row" className="border-b-2 border-ink px-3 py-2.5 text-sm font-normal text-ink">{f.label}</th>
                    <td className="border-b-2 border-l-2 border-ink px-2 py-2.5 text-center"><span className="inline-flex justify-center"><Cell value={f.free} /></span></td>
                    <td className="border-b-2 border-l-2 border-ink bg-sun-pale px-2 py-2.5 text-center"><span className="inline-flex justify-center"><Cell value={f.pro} pro /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Button variant="ghost" fullWidth className="mt-4" onClick={onClose}>
          Not now
        </Button>
      </div>
    </dialog>
  );
}
