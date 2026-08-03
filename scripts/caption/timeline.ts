import type { KeepRange } from "./edl";

// The one place source time becomes output time.
//
// V1 keeps everything, so this is the identity function -- but captions and
// (later) b-roll already route through it, so switching on pause removal in
// Phase 2 is a change to the keep-list only, not to any consumer.

export interface TimeRemap {
  /** Source seconds -> output seconds. Returns null if the instant was cut. */
  toOutput(sourceSec: number): number | null;
  /** Same, but snaps a cut instant to the nearest surviving boundary. */
  toOutputClamped(sourceSec: number): number;
  totalOutputSec: number;
}

export function buildRemap(keep: KeepRange[]): TimeRemap {
  // Precompute the cumulative output offset at the start of each range so
  // lookups stay O(ranges) rather than re-summing every call.
  const ranges = [...keep].sort((a, b) => a.startSec - b.startSec);
  const offsets: number[] = [];
  let acc = 0;
  for (const r of ranges) {
    offsets.push(acc);
    acc += r.endSec - r.startSec;
  }

  const toOutput = (sourceSec: number): number | null => {
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      if (sourceSec >= r.startSec && sourceSec <= r.endSec) {
        return offsets[i] + (sourceSec - r.startSec);
      }
    }
    return null;
  };

  return {
    toOutput,
    toOutputClamped: (sourceSec: number): number => {
      const exact = toOutput(sourceSec);
      if (exact !== null) return exact;
      // Fell in a removed gap: snap forward to the next surviving range, or
      // to the very end if the instant is past the last kept frame.
      for (let i = 0; i < ranges.length; i++) {
        if (sourceSec < ranges[i].startSec) return offsets[i];
      }
      return acc;
    },
    totalOutputSec: acc,
  };
}

export function wholeVideo(durationSec: number): KeepRange[] {
  return [{ startSec: 0, endSec: durationSec }];
}
