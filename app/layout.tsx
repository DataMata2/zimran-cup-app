import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Space Grotesk carries the body copy; Bricolage Grotesque (800, optical size axis) sets headings and money;
// JetBrains Mono sets the uppercase micro-labels. Each is exposed as a CSS variable read by @theme in globals.css.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
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
  themeColor: "#FFF3D6",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${bricolage.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
