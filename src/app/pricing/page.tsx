import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";

export const metadata: Metadata = {
  title: "Pricing — ViralFrame AI",
  description: "Simple pricing for creators. Free to start, upgrade for HD and unlimited exports.",
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    tag: "Try it",
    features: ["3 videos / month", "Watermark", "Standard export", "1 caption style"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Creator",
    price: "$19",
    tag: "Most popular",
    features: ["30 videos / month", "HD export", "No watermark", "All caption styles", "AI cover images"],
    cta: "Go Creator",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$49",
    tag: "For teams",
    features: ["Unlimited videos", "4K export", "All AI styles", "Priority rendering", "Brand kit"],
    cta: "Go Pro",
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow opacity-70" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand">Pricing</div>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight md:text-6xl">
            Simple plans.{" "}
            <span className="font-display italic text-gradient-brand">Viral output.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Start free. Upgrade when your reels start hitting.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative overflow-hidden rounded-2xl border p-8 ${
                t.highlight
                  ? "border-brand/50 bg-surface shadow-glow"
                  : "border-border/60 bg-surface/40"
              }`}
            >
              {t.highlight && (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />
              )}
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{t.name}</h3>
                <span className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t.tag}
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-semibold tracking-tight">{t.price}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <ul className="mt-8 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-brand" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={`mt-10 w-full ${
                  t.highlight
                    ? "bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
                    : "bg-surface-2 text-foreground hover:bg-surface-2/80"
                }`}
              >
                <Link href="/dashboard">{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
