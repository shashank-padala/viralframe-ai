"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";

/** Assumptions are shown on screen — a calculator with hidden maths is a gimmick. */
const WORDS_PER_MIN = 200;
const ERROR_RATE = 0.0185; // 37 errors / ~2,000 words in the reference video
const REVIEW_WPM = 130; // words you can check against audio per minute
const FIX_SECONDS = 12; // per corrected word

export function TimeValue() {
  const [length, setLength] = useState(10);
  const [perMonth, setPerMonth] = useState(8);

  const words = length * WORDS_PER_MIN;
  const errors = Math.round(words * ERROR_RATE);
  const reviewMin = words / REVIEW_WPM;
  const fixMin = (errors * FIX_SECONDS) / 60;
  const perVideo = reviewMin + fixMin;
  const monthlyHours = (perVideo * perMonth) / 60;

  return (
    <section id="time" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <h2 className="text-[clamp(1.6rem,4vw,2.5rem)] font-bold leading-tight">
              The cost isn&apos;t fixing the words.
              <span className="block text-primary">It&apos;s reading all of them to find which ones.</span>
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
              A ten-minute video is about two thousand words. Thirty-seven of them came back wrong.
              To catch those thirty-seven by hand you have to check all two thousand against the
              audio — and you pay that on every video, whether it has thirty-seven errors or three.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
            <div className="space-y-7">
              <div>
                <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  <label htmlFor="len">Video length</label>
                  <span className="text-foreground">{length} min</span>
                </div>
                <Slider
                  id="len"
                  className="mt-3"
                  min={2}
                  max={60}
                  step={1}
                  value={[length]}
                  onValueChange={(v) => setLength(v[0] ?? 10)}
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  <label htmlFor="pm">Videos per month</label>
                  <span className="text-foreground">{perMonth}</span>
                </div>
                <Slider
                  id="pm"
                  className="mt-3"
                  min={1}
                  max={30}
                  step={1}
                  value={[perMonth]}
                  onValueChange={(v) => setPerMonth(v[0] ?? 8)}
                />
              </div>
            </div>

            <div className="mt-7 border-t border-border pt-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Hours back per month
              </p>
              <p className="font-display text-5xl font-bold text-primary">
                {monthlyHours.toFixed(1)}
                <span className="ml-2 text-base font-medium text-muted-foreground">hrs</span>
              </p>
            </div>

            <dl className="mt-6 space-y-2 font-mono text-xs text-muted-foreground">
              <Row k={`${length} min × ${WORDS_PER_MIN} words/min`} v={`${words.toLocaleString()} words`} />
              <Row k={`× 1.85% error rate (37 of ~2,000)`} v={`${errors} words wrong`} />
              <Row k={`review ${words.toLocaleString()} words @ ${REVIEW_WPM}/min`} v={`${reviewMin.toFixed(0)} min`} />
              <Row k={`fix ${errors} words @ ${FIX_SECONDS}s each`} v={`${fixMin.toFixed(1)} min`} />
              <Row k={`per video`} v={`${perVideo.toFixed(0)} min`} strong />
              <Row k={`× ${perMonth} videos`} v={`${monthlyHours.toFixed(1)} hrs`} strong />
            </dl>

            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              These are estimates. The error rate depends on your accent and how many proper nouns
              you use — a product-heavy tech video will be higher, a plain talking-head lower.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border/70 pb-2">
      <dt>{k}</dt>
      <dd className={strong ? "text-foreground" : ""}>{v}</dd>
    </div>
  );
}