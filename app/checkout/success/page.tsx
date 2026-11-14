import { Suspense } from "react";
import { Button } from "@/components/kit/Button";
import { Card } from "@/components/kit/Card";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { getGuestId } from "@/lib/guest";
import { isSupabaseConfigured, setPro } from "@/lib/supabase";
import { getStripe, isSessionPaid, sessionCustomerId } from "@/lib/stripe";

export default function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  // Outside the (site) group, so it draws the site header (wordmark links home) and footer itself.
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-6 sm:py-20">
        <Card padding="lg" className="w-full max-w-md text-center">
          <Suspense fallback={<p className="text-base text-ink-2">Confirming payment…</p>}>
            <Confirm searchParams={searchParams} />
          </Suspense>
        </Card>
      </main>
      <Footer />
    </>
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
    <div className="flex flex-col items-center">
      <span
        aria-hidden
        className={`grid size-14 place-items-center rounded-full border-3 border-ink ${success ? "bg-mint" : "bg-sun-soft"}`}
      >
        {success ? (
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 7v6M12 17h.01" />
          </svg>
        )}
      </span>
      <h1 className="mt-5 font-display text-3xl leading-tight font-extrabold tracking-[-0.035em] text-ink sm:text-4xl">
        {result.title}
      </h1>
      <p className="mt-3 text-base text-ink-2">{result.message}</p>
      <Button href={success ? "/plan?pro=1" : "/plan"} size="lg" fullWidth className="mt-7">
        Back to my plan
      </Button>
    </div>
  );
}
