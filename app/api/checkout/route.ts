import { getOrCreateGuestId } from "@/lib/guest";
import { isPro } from "@/lib/supabase";
import { createCheckoutSession, DEFAULT_PLAN, getOrigin, isPlanId, type PlanId } from "@/lib/stripe";

/** POST /api/checkout: form ({plan}) → 303 to Stripe; JSON ({plan}) → { url }. */
export async function POST(req: Request) {
  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  let plan: unknown = DEFAULT_PLAN;
  try {
    if (isJson) {
      const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
      plan = body.plan ?? DEFAULT_PLAN;
    } else {
      const form = await req.formData().catch(() => null);
      plan = form?.get("plan") ?? DEFAULT_PLAN;
    }
  } catch {
    // fall through with default plan
  }
  if (!isPlanId(plan)) return Response.json({ error: "Unknown plan" }, { status: 400 });

  const origin = getOrigin(req);
  try {
    const guestId = await getOrCreateGuestId();
    if (await isPro(guestId)) {
      return isJson ? Response.json({ url: `${origin}/plan` }) : Response.redirect(`${origin}/plan`, 303);
    }
    const session = await createCheckoutSession({ plan: plan as PlanId, guestId, origin });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return isJson ? Response.json({ url: session.url }) : Response.redirect(session.url, 303);
  } catch (err) {
    console.error("POST /api/checkout failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
