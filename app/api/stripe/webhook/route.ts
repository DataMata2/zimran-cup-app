import type Stripe from "stripe";
import { setPro } from "@/lib/supabase";
import { getStripe, isSessionPaid, sessionCustomerId } from "@/lib/stripe";

/** POST /api/stripe/webhook: verifies the signature and marks guests Pro on checkout completion. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook not configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const guestId = session.client_reference_id ?? session.metadata?.guestId;
    if (guestId && isSessionPaid(session)) {
      try {
        await setPro(guestId, { stripeSessionId: session.id, stripeCustomerId: sessionCustomerId(session) });
      } catch (err) {
        console.error("webhook setPro failed:", err instanceof Error ? err.message : err);
        return Response.json({ error: "Could not record payment" }, { status: 500 });
      }
    }
  }
  return Response.json({ received: true });
}
