import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CaptionDemo } from "./CaptionDemo";
import { videoFacts } from "@/lib/errors";

export function Hero() {
  return (
    <header className="relative overflow-hidden border-b border-border grid-bg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--primary),transparent)] opacity-60" />
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="font-display text-sm font-bold uppercase tracking-[0.25em]">
          Viral<span className="text-primary">frame</span>
        </span>
        <div className="flex items-center gap-6">
          <a
            href="#comparison"
            className="hidden font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            How we&apos;re different
          </a>
          <Link
            href="/login"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </Link>
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14 lg:pb-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-primary">
            Built for accented English
          </p>
          <h1 className="mt-5 text-[clamp(2.1rem,6vw,3.6rem)] font-bold leading-[1.05]">
            Stop fixing the same words after every export.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Caption tools are tuned for American English. If you aren&apos;t, every export means twenty
            minutes correcting names the AI mangled. We read the whole transcript in context and fix
            them before you ever see them.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" className="h-11 px-6 font-medium" asChild>
              <Link href="/dashboard">See what yours gets wrong</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-6" asChild>
              <a href="#comparison">How we&apos;re different</a>
            </Button>
          </div>
          <p className="mt-6 max-w-md border-l-2 border-primary/60 pl-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-mono text-foreground">{videoFacts.wordsCorrected} words</span>{" "}
            fixed automatically in the {videoFacts.minutes}-minute video shown — every one a word
            you&apos;d have corrected by hand.
          </p>
        </div>

        <CaptionDemo />
      </div>
    </header>
  );
}