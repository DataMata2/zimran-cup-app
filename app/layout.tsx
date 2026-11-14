import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Public Sans: a plain, sturdy grotesque with true tabular figures, so every amount lines up.
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Penaltyproof — never pay an IRS underpayment penalty",
  description:
    "For US freelancers: how much to set aside from every payment, and the minimum to pay the IRS by each quarterly deadline to avoid the underpayment penalty. Tax year 2026.",
};

export const viewport: Viewport = {
  themeColor: "#f5f5f0",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
