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

export const metadata: Metadata = {
  title:       "solv-001 — AI-Reasoned Agent Finance on Arc",
  description: "An autonomous AI agent that earns, reasons, and saves on Arc testnet using Circle's full 4-tool stack.",
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
