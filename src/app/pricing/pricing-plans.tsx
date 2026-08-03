"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Tier {
  name: string;
  monthly: number;
  /** Per-month price when paying yearly. Set explicitly rather than derived,
   *  so the prices stay at clean .99 points instead of whatever a percentage
   *  happens to produce. */
  annualMonthly: number;
  tag: string;
  features: string[];
  cta: string;
  highlight: boolean;
}

/** Actual saving for a tier, so nothing on the page has to be rounded up. */
function savingPercent(tier: Tier): number {
  if (tier.monthly === 0) return 0;
  return Math.round((1 - tier.annualMonthly / tier.monthly) * 100);
}

const TIERS: Tier[] = [
  {
    name: "Free",
    monthly: 0,
    annualMonthly: 0,
    tag: "Try it",
    features: [
      "3 videos / month",
      "Up to 10 minutes per video",
      "Context-aware name correction",
      "Subtitle file included",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Creator",
    monthly: 19.99,
    annualMonthly: 9.99,
    tag: "Most popular",
    features: [
      "30 videos / month",
      "Up to 60 minutes per video",
      "Transcript editor with find-and-replace",
      "Layout-aware caption placement",
      "YouTube title, description and chapters",
    ],
    cta: "Go Creator",
    highlight: true,
  },
  {
    name: "Pro",
    monthly: 49.99,
    annualMonthly: 24.99,
    tag: "For teams",
    features: [
      "Unlimited videos",
      "No length limit",
      "Your personal glossary, learned from your edits",
      "Priority rendering",
      "Everything in Creator",
    ],
    cta: "Go Pro",
    highlight: false,
  },
];

/** "$9.99" not "$9.9", and a plain "$0" with no trailing zeros. */
function money(amount: number): string {
  if (amount === 0) return "$0";
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

const MAX_SAVING = Math.max(...TIERS.map(savingPercent));

export function PricingPlans() {
  const [annual, setAnnual] = useState(true);

  return (
    <>
      <div className="mt-10 flex flex-col items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="inline-flex rounded-full border border-border bg-card p-1"
        >
          {([
            ["Monthly", false],
            ["Yearly", true],
          ] as const).map(([label, value]) => (
            <button
              key={label}
              role="radio"
              aria-checked={annual === value}
              onClick={() => setAnnual(value)}
              className={`rounded-full px-5 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors ${
                annual === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          {MAX_SAVING}% off when you pay yearly
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => {
          // The headline figure is always per-month so the tiers stay
          // comparable across the toggle; the annual total is spelled out
          // underneath rather than hidden, since that is what actually gets
          // charged.
          const perMonth = annual ? tier.annualMonthly : tier.monthly;
          const annualTotal = tier.annualMonthly * 12;

          return (
            <div
              key={tier.name}
              className={`relative flex flex-col overflow-hidden rounded-xl border p-7 ${
                tier.highlight
                  ? "border-primary/50 bg-card shadow-[var(--shadow-card)]"
                  : "border-border bg-card/40"
              }`}
            >
              {tier.highlight && <div className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}

              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{tier.name}</h3>
                <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {tier.tag}
                </span>
              </div>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl font-bold tracking-tight">
                  {money(perMonth)}
                </span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>

              <p className="mt-2 min-h-[1.25rem] font-mono text-xs text-muted-foreground">
                {tier.monthly === 0 ? (
                  "Free forever"
                ) : annual ? (
                  <>
                    <span className="line-through opacity-60">{money(tier.monthly * 12)}</span>{" "}
                    <span className="text-foreground">{money(annualTotal)}</span> billed yearly —
                    save {savingPercent(tier)}%
                  </>
                ) : (
                  "billed monthly"
                )}
              </p>

              <ul className="mt-7 flex-1 space-y-3 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={`mt-9 w-full ${
                  tier.highlight
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <Link href="/dashboard">{tier.cta}</Link>
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Yearly plans are billed once, up front. Cancel any time — you keep access until the period
        you have paid for ends.
      </p>
    </>
  );
}
