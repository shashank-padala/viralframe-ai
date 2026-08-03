"use client";

import { useState } from "react";
import { TOTAL_CORRECTIONS } from "@/lib/hero-corrections";

// The value argument, using measured numbers from one real 10-minute video
// rather than invented ones.
//
// The framing that matters: the cost is not fixing 37 words. Fixing 37 words
// is quick. The cost is reading 2,000 words against the audio to find out
// *which* 37 -- and you pay that on every video whether there are 37 errors
// or three.
//
// Every assumption behind the estimate is shown on screen. A time-saved
// calculator with hidden maths is a sales gimmick; one you can check is an
// argument.

/** Measured on the reference video: 10:39, 2,000 words, 37 corrections. */
const REFERENCE = {
  minutes: 10,
  words: 2000,
  corrections: TOTAL_CORRECTIONS,
};

const WORDS_PER_MINUTE_OF_VIDEO = REFERENCE.words / REFERENCE.minutes;
/** Careful review means scrubbing back to check against the audio, not just reading. */
const REVIEW_MINUTES_PER_MINUTE_OF_VIDEO = 2;
/** Locating a word in a timeline editor, fixing it, confirming it. */
const SECONDS_PER_MANUAL_FIX = 25;
/** With corrections already applied you are spot-checking, not proofreading. */
const OUR_REVIEW_MINUTES_PER_MINUTE_OF_VIDEO = 0.3;

function estimate(videoMinutes: number, perMonth: number) {
  const words = Math.round(videoMinutes * WORDS_PER_MINUTE_OF_VIDEO);
  const corrections = Math.round((REFERENCE.corrections / REFERENCE.minutes) * videoMinutes);

  const manual =
    videoMinutes * REVIEW_MINUTES_PER_MINUTE_OF_VIDEO +
    (corrections * SECONDS_PER_MANUAL_FIX) / 60;
  const ours = videoMinutes * OUR_REVIEW_MINUTES_PER_MINUTE_OF_VIDEO;

  return {
    words,
    corrections,
    manual,
    ours,
    savedPerVideo: manual - ours,
    savedPerMonth: (manual - ours) * perMonth,
  };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hrs`;
}

export function TimeSaved() {
  const [videoMinutes, setVideoMinutes] = useState(10);
  const [perMonth, setPerMonth] = useState(8);
  const result = estimate(videoMinutes, perMonth);

  return (
    <section className="border-y border-border/60 bg-surface/50">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          What it&apos;s worth
        </div>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
          The cost isn&apos;t fixing the words.{" "}
          <span className="font-display italic text-highlight">
            It&apos;s reading all of them to find which ones.
          </span>
        </h2>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          A ten-minute video is about two thousand words. Thirty-seven of them came back wrong.
          To catch those thirty-seven by hand you have to check all two thousand against the
          audio — and you pay that on every video, whether it has thirty-seven errors or three.
        </p>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          {/* Controls */}
          <div className="rounded-2xl border border-border/60 bg-card p-7">
            <label className="block">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Typical video length</span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {videoMinutes} min
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={60}
                step={1}
                value={videoMinutes}
                onChange={(e) => setVideoMinutes(Number(e.target.value))}
                className="mt-3 w-full accent-foreground"
              />
            </label>

            <label className="mt-8 block">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Videos per month</span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {perMonth}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={perMonth}
                onChange={(e) => setPerMonth(Number(e.target.value))}
                className="mt-3 w-full accent-foreground"
              />
            </label>

            <dl className="mt-8 space-y-2.5 border-t border-border/60 pt-6 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Words to check</dt>
                <dd className="font-mono tabular-nums">{result.words.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Words likely wrong</dt>
                <dd className="font-mono tabular-nums">{result.corrections}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">By hand</dt>
                <dd className="font-mono tabular-nums">{formatDuration(result.manual)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">With ViralFrame</dt>
                <dd className="font-mono tabular-nums">{formatDuration(result.ours)}</dd>
              </div>
            </dl>
          </div>

          {/* Result */}
          <div className="flex flex-col justify-center">
            <div className="text-sm text-muted-foreground">You get back</div>
            <div className="mt-2 text-6xl font-semibold tracking-tight md:text-7xl">
              {formatDuration(result.savedPerMonth)}
              <span className="ml-3 align-middle text-xl font-normal text-muted-foreground">
                a month
              </span>
            </div>
            <div className="mt-3 text-lg text-muted-foreground">
              {formatDuration(result.savedPerVideo)} per video, at {perMonth} video
              {perMonth === 1 ? "" : "s"} a month.
            </div>

            <div className="mt-10 rounded-xl border border-border/60 bg-background/60 p-5 text-xs leading-relaxed text-muted-foreground">
              <div className="font-medium text-foreground">How this is worked out</div>
              <p className="mt-2">
                Word counts and error rates come from one real ten-minute video —{" "}
                {REFERENCE.words.toLocaleString()} words, {REFERENCE.corrections} corrections —
                scaled to the length you chose. Manual review is estimated at{" "}
                {REVIEW_MINUTES_PER_MINUTE_OF_VIDEO}× the video length, because checking a
                transcript means scrubbing back to the audio rather than just reading, plus{" "}
                {SECONDS_PER_MANUAL_FIX} seconds to find and fix each wrong word. Reviewing
                already-corrected captions is estimated at{" "}
                {OUR_REVIEW_MINUTES_PER_MINUTE_OF_VIDEO}× the video length.
              </p>
              <p className="mt-2">
                These are estimates, not measurements of your workflow. The error rate in
                particular depends heavily on your accent and how many names you use.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
