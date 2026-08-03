import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="grid-bg">
      <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
        <h2 className="text-[clamp(1.8rem,5vw,3rem)] font-bold leading-tight">
          See what your last video got wrong.
        </h2>
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">
          Upload one you&apos;ve already published. We&apos;ll show you every word the captions missed, side
          by side — no signup to see the diff.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" className="h-11 px-6" asChild>
            <Link href="/dashboard">See what yours gets wrong</Link>
          </Button>
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          No credit card · Your words, never rewritten · Cancel anytime
        </p>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-sm font-bold uppercase tracking-[0.25em] text-foreground">
            Viral<span className="text-primary">frame</span>
          </span>
          <span>
            Captioning for long-form landscape video. We fix misheard words, never your English.
          </span>
        </div>
      </footer>
    </section>
  );
}