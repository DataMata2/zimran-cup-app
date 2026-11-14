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

const TITLE = "Penaltyproof — never pay an IRS underpayment penalty";
const DESCRIPTION =
  "For US freelancers: how much to set aside from every payment, and the minimum to pay the IRS by each quarterly deadline to avoid the underpayment penalty. Tax year 2026.";

// The OG image (app/opengraph-image.png) and icons (app/icon.svg, apple-icon.png, favicon.ico) are file
// conventions; metadataBase makes their URLs absolute for link previews.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Penaltyproof",
  openGraph: {
    type: "website",
    siteName: "Penaltyproof",
    title: "Never pay an IRS underpayment penalty again",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Never pay an IRS underpayment penalty again",
    description: DESCRIPTION,
  },
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
