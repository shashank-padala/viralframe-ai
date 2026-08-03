import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Three faces, each with a job: Space Grotesk for headlines and caption
// cards, IBM Plex Sans for reading, JetBrains Mono for the data -- error
// ledgers, timecodes, calculator rows. The mono is doing real work here,
// not decoration: it makes the transcription errors read as records.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ViralFrame — Captions that get accented English right",
  description:
    "Captions for long-form landscape video that fix misheard names in context before you see them. Built for creators who speak accented, non-native English.",
  openGraph: {
    title: "ViralFrame — Captions that get accented English right",
    description:
      "Captions for long-form landscape video that fix misheard names in context before you see them.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${plexSans.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
