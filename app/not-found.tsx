import type { Metadata } from "next";
import { Button } from "@/components/kit/Button";
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
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-20 sm:px-6">
        <p className="text-sm font-semibold text-ink-3">404</p>
        <h1 className="mt-2 text-[2rem] leading-tight font-bold tracking-[-0.025em] text-ink sm:text-4xl">
          There&rsquo;s no page at this address.
        </h1>
        <p className="mt-3 text-base text-ink-2">
          The link may be mistyped or out of date. Anything you saved here is still in this browser.
        </p>
        <Button href="/" size="lg" className="mt-8 w-full sm:w-auto sm:self-start">
          Go to the home page
        </Button>
      </main>
      <Footer />
    </>
  );
}
