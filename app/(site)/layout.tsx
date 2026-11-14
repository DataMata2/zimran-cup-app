import type { ReactNode } from "react";
import { DeadlineStrip } from "@/components/site/DeadlineStrip";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

// Pages with the site header and footer (/, /plan, /how-we-check). The /start quiz sits outside this group and
// draws its own slim top bar, so every question and its Continue button fit on a phone screen.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DeadlineStrip />
      <Header />
      {children}
      <Footer />
    </>
  );
}
