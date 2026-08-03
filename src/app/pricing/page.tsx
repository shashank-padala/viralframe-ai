import type { Metadata } from "next";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { PricingPlans } from "./pricing-plans";

export const metadata: Metadata = {
  title: "Pricing — ViralFrame",
  description:
    "Free to start. Pay yearly and save 50%. Captions that fix misheard names before you ever see them.",
};

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <section className="border-b border-border grid-bg">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Pricing</p>
          <h1 className="mt-4 text-[clamp(2rem,5vw,3.25rem)] font-bold leading-tight">
            Pay for the words you don&apos;t have to fix.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">
            Start free with three videos a month. Upgrade when the time it saves you is worth more
            than the subscription.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <PricingPlans />
      </section>
      <Footer />
    </div>
  );
}
