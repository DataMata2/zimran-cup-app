"use client";

import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/kit/Button";
import { Card } from "@/components/kit/Card";
import { computePlan } from "@/lib/product/plan";
import { refreshPro } from "@/lib/product/pro";
import { startSync } from "@/lib/product/sync";
import { useRestoreSavedPlan } from "@/lib/product/useRestoreSavedPlan";
import { useHydrated, useLog, usePro, useProfile } from "@/lib/product/store";
import { useTodayIso } from "@/lib/product/useTodayIso";
import { Breakdown } from "./Breakdown";
import { CheckoutReturn, type CheckoutNotice } from "./CheckoutReturn";
import { Deadlines } from "./Deadlines";
import { ExampleBanner } from "./ExampleBanner";
import { Notice } from "./Notice";
import { Paywall, type PaywallReason } from "./Paywall";
import { PaymentLog } from "./PaymentLog";
import { PlanActions } from "./PlanActions";
import { PlanHero } from "./PlanHero";
import { PlanSkeleton } from "./PlanSkeleton";
import { AnnualizedCard } from "./AnnualizedCard";
import { AskCard } from "./AskCard";
import { ExportCard } from "./ExportCard";
import { WhyCard } from "./WhyCard";

/** The /plan screen: the two numbers, the payment log with its meter, the deadlines and the breakdown. */
export function PlanApp() {
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useProfile();
  const log = useLog();
  const pro = usePro();
  const asOf = useTodayIso();
  const [paywall, setPaywall] = useState<PaywallReason | null>(null);
  const [notice, setNotice] = useState<CheckoutNotice | null>(null);

  const plan = useMemo(() => (profile && asOf ? computePlan(profile, log, asOf) : null), [profile, log, asOf]);

  // Restore the server copy into an empty browser. Then keep the copy up to date while this page is open,
  // unless the server couldn't be reached (then nothing is sent in this page session).
  const restore = useRestoreSavedPlan();
  const restoring = restore === "checking";
  const syncOn = restore !== "checking" && restore !== "failed";
  useEffect(() => (syncOn ? startSync() : undefined), [syncOn]);

  // No saved answers here or on the server: this page has nothing to show yet.
  useEffect(() => {
    if (hydrated && !restoring && !profile) router.replace("/start");
  }, [hydrated, restoring, profile, router]);

  // The server knows whether this guest paid; the stored flag is only a cache.
  useEffect(() => {
    void refreshPro();
  }, []);

  const openPaywall = useCallback((reason: PaywallReason) => setPaywall(reason), []);

  if (!hydrated || !profile || !plan) {
    return (
      <main className="flex-1" aria-busy>
        <PlanSkeleton />
      </main>
    );
  }

  if (!plan.ok) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-16 sm:px-6">
        <Card padding="lg" role="alert">
          <h1 className="text-xl font-bold tracking-[-0.015em] text-ink">We couldn&rsquo;t read your saved answers.</h1>
          <p className="mt-2 text-base text-ink-2">
            They may be from an older version of Penaltyproof. Your payment log is kept.
          </p>
          <Button href="/start" size="lg" className="mt-6 w-full sm:w-auto">
            Re-enter them →
          </Button>
        </Card>
      </main>
    );
  }

  const { result, input } = plan;
  const aiPlan = { profile, log, asOf: input.asOf };

  return (
    <main className="flex-1">
      {profile.isExample && <ExampleBanner />}
      <Suspense fallback={null}>
        <CheckoutReturn onNotice={setNotice} />
      </Suspense>

      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:pb-24">
        {notice && (
          <Notice tone={notice === "pro" ? "accent" : "quiet"} onDismiss={() => setNotice(null)} className="mb-6">
            {notice === "pro"
              ? "You're Pro. Unlimited logging, screenshot reading, the annualized plan, Ask and CSV export are on."
              : "Checkout cancelled — you're still on the free plan."}
          </Notice>
        )}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-x-14 lg:gap-y-12">
          <div className="flex min-w-0 flex-col gap-8 lg:col-start-1">
            <PlanHero result={result} />
            <WhyCard plan={aiPlan} />
          </div>

          <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-7 lg:row-start-1 lg:self-start">
            <PaymentLog result={result} log={log} pro={pro} asOf={input.asOf} onNeedPro={openPaywall} />
          </div>

          <Deadlines result={result} input={input} className="lg:col-start-1" />
          <AnnualizedCard profile={profile} log={log} asOf={input.asOf} pro={pro} onNeedPro={openPaywall} className="lg:col-start-1" />
          <AskCard plan={aiPlan} pro={pro} onNeedPro={openPaywall} className="lg:col-start-1" />
          <Breakdown result={result} state={profile.state} className="lg:col-start-1" />
          <ExportCard profile={profile} log={log} result={result} asOf={input.asOf} pro={pro} onNeedPro={openPaywall} className="lg:col-start-1" />
          <PlanActions isExample={profile.isExample} className="lg:col-start-1" />
        </div>
      </div>

      <Paywall reason={paywall} onClose={() => setPaywall(null)} />
    </main>
  );
}
