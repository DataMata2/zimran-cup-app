import type { Metadata } from "next";
import { Button } from "@/components/kit/Button";
import { Card } from "@/components/kit/Card";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

export const metadata: Metadata = {
  title: "Page not found · Penaltyproof",
};

// Any URL the app doesn't have. Rendered inside the root layout only, so it draws the site header and
// footer itself (the (site) group's layout doesn't wrap it).
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-16 sm:px-6 sm:py-24">
        <Card padding="lg">
          <p className="inline-block rounded-full border-2 border-ink bg-sun px-3 py-1 font-mono text-xs font-bold tracking-[0.08em] text-ink">404</p>
          <h1 className="mt-4 font-display text-[2rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-ink sm:text-[2.5rem]">
            There&rsquo;s no page at this address.
          </h1>
          <p className="mt-3 text-base text-ink-2">
            The link may be mistyped or out of date. Anything you saved here is still in this browser.
          </p>
          <Button href="/" size="lg" className="mt-8 w-full sm:w-auto">
            Go to the home page
          </Button>
        </Card>
      </main>
      <Footer />
    </>
  );
}
