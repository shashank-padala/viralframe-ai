import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "ViralFrame AI — Turn any video into a viral-ready reel",
  description:
    "Upload your talking video. ViralFrame AI adds B-roll, hooks, captions, and a creator-style layout automatically. Reels, TikToks and Shorts in 60 seconds.",
  openGraph: {
    title: "ViralFrame AI — Reels that edit themselves",
    description:
      "AI transforms your raw talking-head video into a polished short-form reel.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${instrumentSerif.variable} antialiased`}
    >
      <body>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
