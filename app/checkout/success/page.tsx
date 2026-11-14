import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGuestId } from "@/lib/guest";
import { isSupabaseConfigured, setPro } from "@/lib/supabase";
import { getStripe, isSessionPaid, sessionCustomerId } from "@/lib/stripe";

export default function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm text-center">
        <Suspense fallback={<CardContent>Confirming payment…</CardContent>}>
          <Confirm searchParams={searchParams} />
        </Suspense>
      </Card>
    </main>
  );
}

type Result = { title: string; message: string; ok?: boolean };

/** Verifies the session belongs to this guest and is paid, then records Pro (idempotent). */
async function confirm(sessionId: string | undefined): Promise<Result> {
  const fail = (message: string): Result => ({ title: "Payment not confirmed", message });
  if (!sessionId) return fail("Missing checkout session.");
  const guestId = await getGuestId();
  if (!guestId) return fail("No guest session found in this browser.");
  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return fail("Checkout session not found.");
  }
  if (session.client_reference_id !== guestId) return fail("This checkout belongs to a different guest.");
  if (!isSessionPaid(session)) return fail("Payment is not complete yet.");
  if (!isSupabaseConfigured()) return { title: "Payment received", message: "Storage is not configured, so Pro was not saved." };
  try {
    await setPro(guestId, { stripeSessionId: session.id, stripeCustomerId: sessionCustomerId(session) });
  } catch (err) {
    console.error("success setPro failed:", err instanceof Error ? err.message : err);
    return fail("Payment received but could not be recorded. Please contact support.");
  }
  return { title: "You're Pro", message: "Thanks! Your plan is now Pro.", ok: true };
}

async function Confirm({ searchParams }: { searchParams: PageProps<"/checkout/success">["searchParams"] }) {
  const raw = (await searchParams).session_id;
  const result = await confirm(typeof raw === "string" ? raw : undefined);
  const success = result.ok === true;
  return (
    <>
      <CardHeader>
        <CardTitle>{result.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{result.message}</p>
        <Link href={success ? "/plan?pro=1" : "/plan"} className="text-sm font-medium underline underline-offset-4">
          Back to my plan
        </Link>
      </CardContent>
    </>
  );
}
