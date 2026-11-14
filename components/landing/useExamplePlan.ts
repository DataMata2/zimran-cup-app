"use client";

import { useMemo } from "react";
import { estimate, type TaxResult } from "@/lib/tax";
import { buildExample } from "@/lib/product/example";
import { buildTaxInput } from "@/lib/product/input";
import { penaltyMeter, type PenaltyMeter } from "@/lib/product/meter";
import type { LogEntry } from "@/lib/product/types";
import { useTodayIso } from "@/lib/product/useTodayIso";

export interface ExamplePlan {
  result: TaxResult;
  meter: PenaltyMeter;
}

/**
 * The example persona's plan as of today, computed by the engine in the browser (asOf is the local date).
 * Null until the component runs on the client.
 */
export function useExamplePlan(): ExamplePlan | null {
  const asOf = useTodayIso();
  return useMemo(() => {
    if (!asOf) return null;
    const { profile, entry } = buildExample(asOf);
    const log: LogEntry[] = [{ ...entry, id: "example", createdAt: profile.createdAt }];
    const result = estimate(buildTaxInput(profile, log, asOf));
    return { result, meter: penaltyMeter(result, log) };
  }, [asOf]);
}
