"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaptionMorph } from "./caption-morph";
import { TOTAL_CORRECTIONS } from "@/lib/hero-corrections";
import { useIsDesktop, useReducedMotion } from "@/lib/use-media-query";

// Loaded on the client only, after first paint. The static `bg-hero-wash`
// gradient underneath is what the user actually sees first, so the WebGL
// layer is pure enhancement -- if the chunk is slow, blocked, or WebGL is
// unavailable, the hero is unchanged apart from the drift.
const AuroraBackdrop = dynamic(() => import("./aurora-backdrop"), { ssr: false });

export function Hero() {
  const reducedMotion = useReducedMotion();
  const isDesktop = useIsDesktop();
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const parallax = isDesktop && !reducedMotion;

  useEffect(() => {
    if (!parallax) return;
    const onMove = (event: PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      // Offset from the centre of the card, normalised to -0.5..0.5, so the
      // tilt follows the pointer without needing to be over the card.
      const dx = (event.clientX - (rect.left + rect.width / 2)) / window.innerWidth;
      const dy = (event.clientY - (rect.top + rect.height / 2)) / window.innerHeight;
      setTilt({ x: Math.max(-0.5, Math.min(0.5, dx)), y: Math.max(-0.5, Math.min(0.5, dy)) });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [parallax]);

  return (
    <section className="relative overflow-hidden">
      {/* Layer 1 — static gradient, always present; WebGL drifts on top. */}
      <div className="absolute inset-0 bg-hero-wash" />
      {isDesktop && !reducedMotion && (
        <div className="absolute inset-0 opacity-60">
          <AuroraBackdrop reducedMotion={reducedMotion} />
        </div>
      )}
      <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_1fr] lg:pt-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-elevated" />
            Built for accented English
          </div>

          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            Stop fixing{" "}
            <span className="font-display italic text-highlight">the same words</span>{" "}
            after every export.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Caption tools are tuned for American English. If you aren&apos;t, every export means
            twenty minutes correcting names the AI mangled. We read the whole transcript in
            context and fix them before you ever see them.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="bg-gradient-brand text-primary-foreground shadow-elevated hover:opacity-95"
              asChild
            >
              <Link href="/dashboard">
                See what yours gets wrong
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-border/60 bg-surface/40" asChild>
              <Link href="#comparison">
                <Play className="mr-2 h-4 w-4" />
                How we&apos;re different
              </Link>
            </Button>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{TOTAL_CORRECTIONS} words</span> fixed
            automatically in the 10-minute video on the right — every one of them a word you
            would have corrected by hand.
          </p>
        </div>

        {/* Layer 2 + 3 — the frame tilted in Z, caption card floating above. */}
        <div ref={stageRef} className="[perspective:1600px]">
          <div
            className="relative transition-transform duration-300 ease-out will-change-transform"
            style={{
              transform: parallax
                ? `rotateY(${tilt.x * 10 - 4}deg) rotateX(${-tilt.y * 8 + 2}deg)`
                : "rotateY(-4deg) rotateX(2deg)",
              transformStyle: "preserve-3d",
            }}
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero/frame.jpg"
                alt="A frame from a real video being captioned"
                className="w-full"
                width={1280}
                height={720}
                loading="eager"
              />
            </div>

            <div
              className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[9%]"
              style={{ transform: "translateZ(60px)" }}
            >
              <CaptionMorph reducedMotion={reducedMotion} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
