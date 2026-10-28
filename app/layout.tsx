import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], style: ["normal", "italic"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "League Captain",
  description: "AI lineup strategist for Cross Club Pickleball captains",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
