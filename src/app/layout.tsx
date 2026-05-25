import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets:  ["latin"],
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets:  ["latin"],
  variable: "--font-mono",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://solv-001.vercel.app";

export const metadata: Metadata = {
  title:       "SOLV-001: Autonomous AI Agent Finance",
  description: "An autonomous AI agent that earns USDC, reasons with Claude, pays expenses via x402, and sweeps idle capital into USYC yield. All on-chain on Arc testnet.",
  metadataBase: new URL(APP_URL),
  icons: {
    icon:     "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type:        "website",
    url:         APP_URL,
    title:       "SOLV-001: Autonomous AI Agent Finance",
    description: "It earns. It reasons. It compounds. An AI agent that manages its own USDC treasury on Arc, using Circle's full tool stack.",
    siteName:    "SOLV-001",
    images: [{
      url:    "/api/og",
      width:  1200,
      height: 630,
      alt:    "SOLV-001: Autonomous AI Agent Finance on Arc",
    }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "SOLV-001: Autonomous AI Agent Finance",
    description: "It earns. It reasons. It compounds. AI agent treasury on Arc testnet.",
    images:      ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${mono.variable} font-sans antialiased`}>
        {children}
      </body>

    </html>
  );
}
