import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Upload,
  Wand2,
  Share2,
  Play,
  Check,
  Sparkles,
  Zap,
  Film,
  Type,
  Image as ImageIcon,
  Captions,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { ReelMockup } from "@/components/site/reel-mockup";

export const metadata: Metadata = {
  title: "ViralFrame AI — Turn any video into a viral-ready reel",
  description:
    "Upload your talking video. AI adds B-roll, hooks, captions and a creator-style layout automatically.",
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow" />
        <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-glow" />
              New — 1-click viral reels
            </div>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
              Turn any video into a{" "}
              <span className="font-display italic text-gradient-brand">viral reel</span>{" "}
              in seconds.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Upload your talking video. AI adds B-roll, hooks, captions and a creator-style
              layout automatically — ready for Reels, TikTok and Shorts.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
                asChild
              >
                <Link href="/dashboard">
                  <Upload className="mr-2 h-4 w-4" /> Upload your video
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-border/60 bg-surface/40">
                <Play className="mr-2 h-4 w-4" /> Watch demo
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-7 w-7 rounded-full border-2 border-background bg-gradient-brand"
                    style={{ filter: `hue-rotate(${i * 40}deg)` }}
                  />
                ))}
              </div>
              <span>Trusted by 12,400+ creators shipping daily</span>
            </div>
          </div>

          {/* Hero visual: Before → After */}
          <div className="relative flex items-center justify-center">
            <div className="relative flex items-center gap-4">
              {/* Before */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Before
                </div>
                <div className="relative aspect-[9/16] w-[180px] overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=70"
                    alt="Raw"
                    className="h-full w-full object-cover grayscale"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-[10px] text-white/70">
                    raw_take_04.mp4
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-brand shadow-glow">
                  <Wand2 className="h-4 w-4 text-primary-foreground" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* After */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-brand">
                  After
                </div>
                <div className="animate-float">
                  <ReelMockup compact={false} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand">
            How it works
          </div>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Three steps.{" "}
            <span className="font-display italic text-muted-foreground">No editing skills.</span>
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              icon: Upload,
              title: "Upload your video",
              body: "Drag in a talking-head recording. MP4, MOV — up to 2GB.",
            },
            {
              n: "02",
              icon: Wand2,
              title: "AI edits everything",
              body: "Hook, B-roll, split-layout, captions and cover — all in ~60 seconds.",
            },
            {
              n: "03",
              icon: Share2,
              title: "Post everywhere",
              body: "Download 9:16 exports for Reels, TikTok and YouTube Shorts.",
            },
          ].map((s) => (
            <div
              key={s.n}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface p-6 transition hover:border-brand/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{s.n}</span>
                <s.icon className="h-5 w-5 text-brand" />
              </div>
              <h3 className="mt-8 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-brand opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </section>

      {/* WHAT AI DOES */}
      <section className="border-y border-border/60 bg-surface/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand">
              The magic
            </div>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              Everything a{" "}
              <span className="font-display italic text-gradient-brand">professional editor</span>{" "}
              would do — automatically.
            </h2>
            <div className="mt-8 grid gap-3">
              {[
                { icon: Type, t: "Viral hook & title overlay" },
                { icon: Film, t: "Split-screen creator layout" },
                { icon: Sparkles, t: "AI-selected B-roll footage" },
                { icon: Captions, t: "Hormozi-style captions" },
                { icon: ImageIcon, t: "Cover image & thumbnail" },
                { icon: Zap, t: "Ready-to-post 9:16 export" },
              ].map((f) => (
                <div
                  key={f.t}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand">
                    <f.icon className="h-4 w-4 text-primary-foreground" />
                  </span>
                  <span className="text-sm">{f.t}</span>
                </div>
              ))}
            </div>
          </div>

          <div id="examples" className="flex items-center justify-center">
            <div className="grid grid-cols-2 gap-4">
              <div className="translate-y-6">
                <ReelMockup
                  compact
                  hook="THE AI WAR HAS STARTED"
                  broll="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=600&q=70"
                  face="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=600&q=70"
                  caption="AI • openai • war"
                />
              </div>
              <div>
                <ReelMockup
                  compact
                  hook="Every founder should know this"
                  broll="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=70"
                  face="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=600&q=70"
                  caption="startup • growth"
                />
              </div>
              <div>
                <ReelMockup
                  compact
                  hook="India's biggest EV mistake"
                  broll="https://images.unsplash.com/photo-1593941707882-a5bac6861d75?auto=format&fit=crop&w=600&q=70"
                  face="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=70"
                  caption="EV • battery • india"
                />
              </div>
              <div className="translate-y-6">
                <ReelMockup
                  compact
                  hook="Nobody talks about this trick"
                  broll="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=70"
                  face="https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=600&q=70"
                  caption="hacks • trending"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TEMPLATES */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-brand">
              Templates
            </div>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">Built for every creator</h2>
          </div>
          <Link href="/dashboard" className="hidden text-sm text-muted-foreground hover:text-foreground md:inline">
            Try a template →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { t: "Business Creator", c: "Founders & operators" },
            { t: "Finance", c: "Markets, macro, investing" },
            { t: "Podcast Clips", c: "Long-form → shorts" },
            { t: "Educational", c: "Explainers & threads" },
          ].map((tpl) => (
            <div
              key={tpl.t}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border/60 bg-surface"
            >
              <div className="absolute inset-0 bg-gradient-brand opacity-20 transition group-hover:opacity-40" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-brand">
                  Template
                </div>
                <div className="mt-1 text-lg font-semibold">{tpl.t}</div>
                <div className="text-xs text-muted-foreground">{tpl.c}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-12 text-center shadow-card">
          <div className="absolute inset-0 bg-hero-glow opacity-70" />
          <div className="relative">
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Stop editing.{" "}
              <span className="font-display italic text-gradient-brand">Start posting.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Your first 3 reels are on us. No credit card, no editor required.
            </p>
            <Button
              size="lg"
              className="mt-8 bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
              asChild
            >
              <Link href="/dashboard">
                Upload your video <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Check className="h-3 w-3 text-brand" /> No credit card</span>
              <span className="flex items-center gap-1"><Check className="h-3 w-3 text-brand" /> 60-second exports</span>
              <span className="flex items-center gap-1"><Check className="h-3 w-3 text-brand" /> Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
