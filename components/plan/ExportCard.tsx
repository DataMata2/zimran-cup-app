"use client";

import { useState } from "react";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { buildAnnualizedInput } from "@/lib/product/annualizedPlan";
import { buildCsv, downloadCsv } from "@/lib/product/csv";
import type { LogEntry, Profile } from "@/lib/product/types";
import { annualized, type AnnualizedResult, type TaxResult } from "@/lib/tax";
import { proCardClasses, ProSticker } from "./LockIcon";
import type { PaywallReason } from "./Paywall";

/** "Export for your accountant (CSV)" (Pro): the log, the instalments and the breakdown, built in the browser. */
export function ExportCard({
  profile,
  log,
  result,
  asOf,
  pro,
  onNeedPro,
  className,
}: {
  profile: Profile;
  log: readonly LogEntry[];
  result: TaxResult;
  asOf: string;
  pro: boolean;
  onNeedPro: (reason: PaywallReason) => void;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  function exportCsv() {
    if (!pro) {
      onNeedPro("export");
      return;
    }
    let ai: AnnualizedResult | null = null;
    try {
      ai = annualized(buildAnnualizedInput(profile, log, asOf));
    } catch {
      // The annualized section is optional; the rest of the export doesn't depend on it.
    }
    downloadCsv(buildCsv({ log, result, annualized: ai, asOf, preLogPaid: profile.estimatedPaid }));
    setDone(true);
  }

  return (
    <section aria-labelledby="export-title" className={cx(proCardClasses(!pro), className)}>
      <div className="flex items-center gap-2">
        <h2 id="export-title" className="font-display text-2xl leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[1.75rem]">
          For your accountant
        </h2>
        {!pro && <ProSticker />}
      </div>
      <p className="mt-2 max-w-[62ch] text-base text-ink-2">
        Your payment log, the four instalments and the tax breakdown in one spreadsheet file.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button size="lg" className="w-full text-center whitespace-normal! sm:w-auto" onClick={exportCsv}>
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11" />
          </svg>
          Export for your accountant (CSV)
        </Button>
        <p role="status" className="text-sm text-ink-2">
          {done ? "Your CSV is ready." : pro ? "Opens in Excel, Numbers or Google Sheets." : "Included with Pro."}
        </p>
      </div>
    </section>
  );
}
