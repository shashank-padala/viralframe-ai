// The edit document ("EDL") is the single intermediate artifact of the
// captioning pipeline. Every analysis stage writes into it; the renderer is
// a pure function of it.
//
// Why this shape matters: Phase 2 (pause/filler removal) deletes time from
// the middle of the source, which invalidates every timestamp after the cut
// -- captions, b-roll placements, total duration. Funnelling all of them
// through one document means the source->output time remap is defined once
// (see `timeline.ts`) instead of being re-derived, slightly differently, in
// each consumer.

export const EDL_VERSION = 1;

export interface SourceMeta {
  /** Absolute path to the original file, as given to the CLI. */
  path: string;
  durationSec: number;
  width: number;
  height: number;
  /** Real frame rate, not rounded -- render matches this exactly. */
  fps: number;
  hasAudio: boolean;
}

/** Vertical band the caption sits in for a stretch of the video. */
export type CaptionBand = "top" | "center" | "bottom";

/**
 * Horizontal alignment within the band.
 *
 * Three vertical bands alone cannot describe the safe zone of a screen
 * recording with a webcam picture-in-picture: the only clear area is often
 * "low, but away from the corner the webcam occupies". Optional so edit
 * documents written before this existed still parse as centered.
 */
export type CaptionAlign = "left" | "center" | "right";

export interface CaptionWord {
  /** Deepgram's `punctuated_word` -- "18,000" and "AI", not "eighteen thousand" and "ai". */
  text: string;
  startSec: number;
  endSec: number;
  /** At most one word per card carries this. */
  highlight: boolean;
}

export interface CaptionCard {
  index: number;
  /** When the card appears on screen (includes lead-in). */
  startSec: number;
  /** When it leaves (includes hold-out / bridge to the next card). */
  endSec: number;
  words: CaptionWord[];
}

export interface PlacementSegment {
  startSec: number;
  endSec: number;
  band: CaptionBand;
  /** Defaults to "center" when absent. */
  align?: CaptionAlign;
  /** Why this zone was chosen -- kept for debugging a bad placement. */
  reason?: string;
  /** What the frame looked like, for the same reason. */
  layout?: string;
}

/**
 * A range of SOURCE time that survives into the output. V1 always emits a
 * single range covering the whole video; Phase 2 emits many.
 */
export interface KeepRange {
  startSec: number;
  endSec: number;
}

export interface EditDocument {
  version: typeof EDL_VERSION;
  createdAt: string;
  source: SourceMeta;
  /** Hash of the source file -- lets a re-run skip the paid stages. */
  sourceHash: string;
  cards: CaptionCard[];
  placement: PlacementSegment[];
  keep: KeepRange[];
  styleId: string;
}

/** Total output duration implied by the keep-list. */
export function outputDurationSec(edl: EditDocument): number {
  return edl.keep.reduce((total, r) => total + (r.endSec - r.startSec), 0);
}

/**
 * Band in effect at a given output time. Placement segments are stored in
 * output time (already remapped), contiguous and sorted.
 */
export function bandAt(placement: PlacementSegment[], t: number): CaptionBand {
  for (const seg of placement) {
    if (t >= seg.startSec && t < seg.endSec) return seg.band;
  }
  return placement.at(-1)?.band ?? "bottom";
}
