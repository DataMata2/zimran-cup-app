import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getGuestId } from "@/lib/guest";
import { isPro } from "@/lib/supabase";
import { formatPlanPrice, PLANS, type PlanId } from "@/lib/stripe";

const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export default function PricingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-4 sm:flex-row">
        {PLAN_IDS.map((id) => (
          <Card key={id} className="w-full">
            <CardHeader>
              <CardTitle>{PLANS[id].name}</CardTitle>
              <CardDescription>{PLANS[id].description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatPlanPrice(id)}</p>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3">
              <Suspense fallback={<Button disabled>Upgrade</Button>}>
                <UpgradeAction plan={id} />
              </Suspense>
            </CardFooter>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Demo: use test card 4242 4242 4242 4242, any future date, any CVC.
      </p>
    </main>
  );
}

async function UpgradeAction({ plan }: { plan: PlanId }) {
  const guestId = await getGuestId();
  if (guestId && (await isPro(guestId))) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <p className="font-medium">You&apos;re Pro</p>
        <Link href="/plan" className="text-sm underline underline-offset-4">
          Back to my plan
        </Link>
      </div>
    );
  }
  return (
    <form action="/api/checkout" method="POST">
      <input type="hidden" name="plan" value={plan} />
      <Button type="submit" className="w-full">
        Upgrade
      </Button>
    </form>
  );
}
