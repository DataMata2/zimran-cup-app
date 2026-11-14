import { connection } from "next/server";
import { getGuestId, getOrCreateGuestId } from "@/lib/guest";
import { getPlanData, putPlanData, type PlanDataDeps } from "@/lib/product/planDataHandlers";
import { getGuestPlan, saveGuestPlan } from "@/lib/supabase";

const deps: PlanDataDeps = { getGuestId, getOrCreateGuestId, load: getGuestPlan, save: saveGuestPlan };

/** GET /api/plan-data: `{ data }`, the server copy of this guest's plan (null when there is none). */
export async function GET() {
  // Per-request answer from the cookie: never prerender it.
  await connection();
  return getPlanData(deps);
}

/** PUT /api/plan-data `{ profile, log, added }`: save the copy for this guest (creates the guest if needed). */
export async function PUT(request: Request) {
  return putPlanData(request, deps);
}
