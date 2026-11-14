import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getGuestId } from "@/lib/guest";
import { isPro } from "@/lib/supabase";
import { formatPlanPrice, PLANS } from "@/lib/stripe";

export default function PricingPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{PLANS.pro.name}</CardTitle>
          <CardDescription>{PLANS.pro.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatPlanPrice("pro")}</p>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Suspense fallback={<Button disabled>Upgrade</Button>}>
            <UpgradeAction />
          </Suspense>
        </CardFooter>
      </Card>
    </main>
  );
}

async function UpgradeAction() {
  const guestId = await getGuestId();
  if (guestId && (await isPro(guestId))) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <p className="font-medium">You&apos;re Pro</p>
        <Link href="/app" className="text-sm underline underline-offset-4">
          Back to the app
        </Link>
      </div>
    );
  }
  return (
    <>
      <form action="/api/checkout" method="POST">
        <input type="hidden" name="plan" value="pro" />
        <Button type="submit" className="w-full">
          Upgrade
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Demo: use test card 4242 4242 4242 4242, any future date, any CVC.
      </p>
    </>
  );
}
