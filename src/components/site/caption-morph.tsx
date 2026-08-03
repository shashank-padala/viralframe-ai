"use client";

import { useEffect, useMemo, useState } from "react";
import { HERO_CORRECTIONS } from "@/lib/hero-corrections";

// The product demo, not decoration.
//
// A caption card cycles through corrections that actually happened in a
// real video: the wrong version lands and holds long enough to register as
// wrong, then it is struck through and the correct term snaps in with the
// highlight. Styled to match what the renderer actually burns in --
// uppercase, heavy, thick black stroke, one yellow word.
//
// This is why the hero keeps captions as DOM text rather than a WebGL
// texture: the type has to be as crisp here as it is in the export.

const WRONG_HOLD_MS = 1500;
const STRIKE_MS = 420;
const RIGHT_HOLD_MS = 2100;

type Phase = "wrong" | "striking" | "right";

export function CaptionMorph({ reducedMotion }: { reducedMotion: boolean }) {
  const [index, setIndex] = useState(0);
  // Starts on the *corrected* state deliberately. The server cannot know
  // whether motion is allowed, so it renders the reduced-motion view; if
  // the cycle then began on "wrong", hydration would visibly swap the word
  // the instant the page came alive. Starting where the server left off
  // means the first frame is stable, and the cycle picks up from the next
  // correction.
  const [cyclePhase, setCyclePhase] = useState<Phase>("right");

  // With reduced motion the card is a static exhibit showing the corrected
  // state. Derived during render rather than pushed into state from an
  // effect, which would cost an extra render on mount for no benefit.
  const phase: Phase = reducedMotion ? "right" : cyclePhase;

  // One timer per state, so the machine can never have overlapping
  // schedules and every transition is cancellable on unmount.
  useEffect(() => {
    if (reducedMotion) return;

    if (cyclePhase === "right") {
      const timer = setTimeout(() => {
        setIndex((i) => (i + 1) % HERO_CORRECTIONS.length);
        setCyclePhase("wrong");
      }, RIGHT_HOLD_MS);
      return () => clearTimeout(timer);
    }

    if (cyclePhase === "wrong") {
      const timer = setTimeout(() => setCyclePhase("striking"), WRONG_HOLD_MS);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => setCyclePhase("right"), STRIKE_MS);
    return () => clearTimeout(timer);
  }, [cyclePhase, reducedMotion]);

  const item = HERO_CORRECTIONS[index];
  const showing = phase === "right" ? item.right : item.wrong;

  // Keyed so React swaps the node rather than diffing the text, which is
  // what lets the entering word run its own animation.
  const wordKey = useMemo(() => `${index}-${phase === "right"}`, [index, phase]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center"
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          // Matches the burned-in look: white on a thick black stroke, so it
          // survives any background.
          WebkitTextStroke: "0.05em #000",
          paintOrder: "stroke fill",
          textShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}
      >
        {item.before.map((word, i) => (
          <span key={`b${i}`} className="text-white/90 text-[clamp(1rem,2.6vw,1.65rem)]">
            {word}
          </span>
        ))}

        <span className="relative inline-block text-[clamp(1rem,2.6vw,1.65rem)]">
          <span
            key={wordKey}
            className={
              phase === "right"
                ? "inline-block animate-word-in text-[#FFD400]"
                : "inline-block text-white/90"
            }
          >
            {showing}
          </span>
          {/* The strike is what makes it read as an error being caught,
              rather than the text simply changing. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-red-500 transition-[width,opacity] duration-300 ease-out"
            style={{
              width: phase === "striking" ? "100%" : "0%",
              opacity: phase === "striking" ? 1 : 0,
            }}
          />
        </span>

        {item.after.map((word, i) => (
          <span key={`a${i}`} className="text-white/90 text-[clamp(1rem,2.6vw,1.65rem)]">
            {word}
          </span>
        ))}
      </div>

      <p className="text-[11px] font-medium uppercase tracking-widest text-white/45">
        {phase === "right" ? "what you actually said" : "what every other tool heard"}
      </p>
    </div>
  );
}
