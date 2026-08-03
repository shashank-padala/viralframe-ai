import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  Highlighter,
  LayoutTemplate,
  Pencil,
  SpellCheck,
  MonitorPlay,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { Comparison } from "@/components/site/comparison";
import { TimeSaved } from "@/components/site/time-saved";

export const metadata: Metadata = {
  title: "ViralFrame AI — Captions that get your accent right",
  description:
    "Caption tools are tuned for American English. ViralFrame reads your whole transcript in context and fixes the names and terms other tools mangle — before you ever see them.",
  openGraph: {
    title: "ViralFrame AI — Captions that get your accent right",
    description:
      "Stop hand-fixing the same words after every export. Context-aware caption correction for accented English.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

const STEPS = [
  {
    n: "01",
    title: "Upload your video",
    body: "Any length, any resolution.",
  },
  {
    n: "02",
    title: "We fix it in context",
    body: "The whole transcript is read as one piece, so names get corrected the way a human would.",
  },
  {
    n: "03",
    title: "You check what's left",
    body: "Click any word to jump there. Find-and-replace handles anything recurring.",
  },
  {
    n: "04",
    title: "Export everything",
    body: "Captioned video, subtitle file, and YouTube copy.",
  },
];

const FEATURES = [
  {
    icon: SpellCheck,
    title: "Context-aware correction",
    body: "“mid construct” becomes semiconductor. “carried it” becomes carry trade. Fixed once, then applied everywhere that phrase appears.",
  },
  {
    icon: LayoutTemplate,
    title: "Layout-aware placement",
    body: "Each shot is read to find where captions won't cover your face or the thing you're pointing at — including the corner your webcam sits in.",
  },
  {
    icon: Highlighter,
    title: "One word emphasised",
    body: "The word carrying the meaning gets the highlight, and only about a third of cards get one. Emphasise everything and you've emphasised nothing.",
  },
  {
    icon: Pencil,
    title: "A transcript you can edit",
    body: "Play the video, click a word, correct it. Every fix is a word swap — your sentences are never rewritten.",
  },
  {
    icon: FileText,
    title: "Subtitle file included",
    body: "A faithful .srt alongside the burned-in captions, so the accessibility version stays verbatim.",
  },
  {
    icon: MonitorPlay,
    title: "YouTube copy written for you",
    body: "Title options, a description, chapters and hashtags — generated from the corrected transcript, so your product names are spelled right.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <Hero />

      <TimeSaved />

      <Comparison />

      {/* FEATURES */}
      <section id="examples" className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand">
          What you get
        </div>
        <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Everything a careful editor would do —{" "}
          <span className="font-display italic text-highlight">
            without the twenty minutes.
          </span>
        </h2>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface p-6 transition hover:border-brand/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand shadow-elevated">
                <feature.icon className="h-5 w-5 text-primary-foreground" />
              </span>
              <div className="mt-5 text-lg font-semibold">{feature.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — deliberately last and deliberately small. Three of
          these four steps are self-evident; only the correction step is
          interesting, and the hero and comparison already argue that far
          better. This is orientation for someone already convinced, so it
          gets a strip rather than a section. */}
      <section className="mx-auto max-w-7xl px-6 pb-8">
        <div className="rounded-2xl border border-border/60 bg-surface/40 p-8">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Start to finish
          </div>
          <ol className="mt-6 grid gap-6 md:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-3">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {step.n}
                </span>
                <span>
                  <span className="block text-sm font-medium">{step.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-12 text-center shadow-card">
          <div className="absolute inset-0 bg-hero-wash opacity-70" />
          <div className="relative">
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
              See what your last video{" "}
              <span className="font-display italic text-highlight">got wrong.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Upload one you&apos;ve already published. We&apos;ll show you every word the
              captions missed.
            </p>
            <Button
              size="lg"
              className="mt-8 bg-gradient-brand text-primary-foreground shadow-elevated hover:opacity-95"
              asChild
            >
              <Link href="/dashboard">
                Upload a video <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-brand" /> No credit card
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-brand" /> Your words, never rewritten
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-brand" /> Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
