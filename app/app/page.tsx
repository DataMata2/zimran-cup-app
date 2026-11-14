import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startGuest } from "@/app/actions";
import { getGuestId } from "@/lib/guest";
import { isPro } from "@/lib/supabase";

export default function AppPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Placeholder app</CardTitle>
          <CardDescription>The product goes here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <GuestStatus />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function GuestStatus() {
  const guestId = await getGuestId();
  if (!guestId) {
    return (
      <form action={startGuest} className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">No guest session yet.</p>
        <Button type="submit">Try it (no sign-up)</Button>
      </form>
    );
  }
  const pro = await isPro(guestId);
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm">
        Plan: <span className="font-medium">{pro ? "Pro" : "Free"}</span>
      </p>
      <Link href="/pricing" className="text-sm font-medium underline underline-offset-4">
        {pro ? "Billing" : "Upgrade to Pro"}
      </Link>
    </div>
  );
}
