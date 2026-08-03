"use client";

import { useEffect, useState } from "react";
import { captionErrors } from "@/lib/errors";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * The pitch: a real caption error caught and corrected, over a real video frame.
 * With reduced motion, the same point is made statically.
 */
export function CaptionDemo() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [corrected, setCorrected] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const toCorrect = window.setTimeout(() => setCorrected(true), 1600);
    const toNext = window.setTimeout(() => {
      setCorrected(false);
      setI((n) => (n + 1) % captionErrors.length);
    }, 4200);
    return () => {
      window.clearTimeout(toCorrect);
      window.clearTimeout(toNext);
    };
  }, [i, reduced]);

  const e = captionErrors[i] ?? captionErrors[0]!;
  const showRight = reduced || corrected;

  return (
    <figure className="relative overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="relative aspect-video w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero/video-frame.jpg"
          alt="Frame from a ten-minute long-form video of a creator talking to camera"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,oklch(0_0_0/0.8),transparent_55%)]" />

        {/* placement callout */}
        <div className="absolute right-3 top-3 rounded-full border border-border/70 bg-background/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur sm:text-[11px]">
          captions placed clear of face + chart
        </div>

        {/* caption card */}
        <div className="absolute inset-x-0 bottom-[8%] flex flex-col items-center gap-2 px-4 text-center">
          <div
            key={`${i}-${showRight}`}
            className="caption-card flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-[clamp(1.05rem,4.2vw,2.1rem)] leading-tight text-[var(--paper)]"
            style={{ animation: "swap-in 260ms ease-out" }}
          >
            <span className="opacity-70">{e.before}</span>
            {showRight ? (
              <span className="rounded-md bg-[var(--right-soft)] px-2 text-[var(--right)]">
                {e.right}
              </span>
            ) : (
              <span className="relative rounded-md bg-[var(--wrong-soft)] px-2 text-[var(--wrong)]">
                {e.wrong}
                <span
                  className="absolute left-1 right-1 top-1/2 h-[2px] origin-left bg-[var(--wrong)]"
                  style={{ animation: "strike 420ms 900ms ease-out both" }}
                />
              </span>
            )}
            {e.after ? <span className="opacity-70">{e.after}</span> : null}
          </div>
        </div>
      </div>

      {/* Label above value rather than beside it. Sharing one line meant the
          word itself -- the only part that matters -- was the thing that got
          truncated ("CLORC…"), while the static label kept its full width. */}
      <figcaption className="grid grid-cols-2 divide-x divide-border border-t border-border font-mono text-[11px] uppercase tracking-widest">
        <div className="flex flex-col gap-1.5 px-3 py-3 sm:px-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--wrong)]" />
            what every other tool heard
          </span>
          <span className="pl-3.5 text-[13px] text-[var(--wrong)] line-through decoration-[var(--wrong)]/50">
            {e.wrong}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-3 sm:px-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--right)]" />
            what you actually said
          </span>
          <span className="pl-3.5 text-[13px] text-[var(--right)]">{e.right}</span>
        </div>
      </figcaption>
    </figure>
  );
}