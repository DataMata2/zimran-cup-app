import type { ReactNode } from "react";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

// Pages with the site header and footer (/, /plan). The /start quiz sits outside this group and draws
// its own slim top bar, so every question and its Continue button fit on a phone screen.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
