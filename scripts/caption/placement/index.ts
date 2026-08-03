import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CaptionAlign, CaptionBand, PlacementSegment, SourceMeta } from "../edl";
import { detectShotBoundaries, extractFrame } from "../lib/media";

// Chooses which vertical band the captions sit in, per shot.
//
// The naive version -- detect the face every frame, place captions
// elsewhere -- looks terrible, because the band ends up twitching between
// positions several times a second. Placement is a *shot-level* property:
// it should change when the layout of the frame changes (webcam only ->
// screen share -> picture-in-picture) and at no other time.
//
// So: find shot boundaries with ffmpeg, sample one representative frame per
// shot, ask a vision model once about all of them, then apply hysteresis
// before committing to any move.

const MODEL = "gpt-5.6-luna";
/** Shots shorter than this never get their own band -- they inherit. */
const MIN_SHOT_FOR_MOVE_SEC = 3;
/** Cap the vision spend and payload on a long video. */
const MAX_SAMPLES = 40;
/** Shortest stretch that gets its own placement look. */
const MIN_SEGMENT_SEC = 25;

interface ShotSample {
  index: number;
  startSec: number;
  endSec: number;
  atSec: number;
  framePath: string;
}

interface BandVerdict {
  index: number;
  band: CaptionBand;
  align: CaptionAlign;
  layout: string;
  reason: string;
}

interface OpenAIResponse {
  choices?: { message?: { content?: string } }[];
}

function buildShots(boundaries: number[], durationSec: number): { startSec: number; endSec: number }[] {
  const cuts = [0, ...boundaries.filter((t) => t > 0.5 && t < durationSec - 0.5), durationSec];
  const shots: { startSec: number; endSec: number }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    if (cuts[i + 1] - cuts[i] > 0.4) shots.push({ startSec: cuts[i], endSec: cuts[i + 1] });
  }
  return shots.length > 0 ? shots : [{ startSec: 0, endSec: durationSec }];
}

/**
 * Scene detection badly under-segments a screen recording: scrolling a feed
 * or switching tabs rarely trips the scene score, so a 10-minute video can
 * come back as three "shots" and placement effectively never adapts. What
 * is on screen still changes constantly, so long shots are subdivided on a
 * clock and each chunk gets its own look.
 *
 * The chunk length stretches if a video is long enough that fixed chunks
 * would blow the sample budget.
 */
function subdivide(
  shots: { startSec: number; endSec: number }[],
  durationSec: number
): { startSec: number; endSec: number }[] {
  const target = Math.max(MIN_SEGMENT_SEC, durationSec / MAX_SAMPLES);
  const out: { startSec: number; endSec: number }[] = [];

  for (const shot of shots) {
    const length = shot.endSec - shot.startSec;
    if (length <= target * 1.5) {
      out.push(shot);
      continue;
    }
    const pieces = Math.max(1, Math.round(length / target));
    const step = length / pieces;
    for (let i = 0; i < pieces; i++) {
      out.push({
        startSec: shot.startSec + i * step,
        endSec: i === pieces - 1 ? shot.endSec : shot.startSec + (i + 1) * step,
      });
    }
  }
  return out;
}

/**
 * If shot detection returns very many cuts (common with a scrolling feed on
 * screen, which trips the scene score constantly), keep the longest shots:
 * those are the ones whose layout is worth analysing.
 */
function selectShots(shots: { startSec: number; endSec: number }[]): { startSec: number; endSec: number }[] {
  if (shots.length <= MAX_SAMPLES) return shots;
  const kept = [...shots]
    .sort((a, b) => b.endSec - b.startSec - (a.endSec - a.startSec))
    .slice(0, MAX_SAMPLES)
    .sort((a, b) => a.startSec - b.startSec);
  return kept;
}

async function classifyFrames(samples: ShotSample[]): Promise<BandVerdict[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  // The prompt classifies the layout before choosing a zone. An earlier
  // version assumed "talking head with a screen share behind them" and told
  // the model to avoid all readable text -- which in a full-screen screen
  // recording describes the entire frame, so it had no valid answer and
  // returned essentially arbitrary bands that sat on top of the content.
  // Naming the layout first gives each case its own rule.
  const content: unknown[] = [
    {
      type: "text",
      text: [
        "Each image is one shot from a video that will have 3-4 word burned-in subtitles",
        "(large, bold, uppercase, roughly 6% of the frame height).",
        "",
        "For each image, first classify the layout:",
        "- talking_head: a person fills most of the frame.",
        "- screen_with_webcam: a screen recording (browser, slides, editor, terminal) fills the",
        "  frame, with a small webcam inset in one corner.",
        "- screen_only: a screen recording with no webcam.",
        "- other: anything else.",
        "",
        "Then choose the zone where subtitles do the least damage, as a vertical band",
        "(top/center/bottom) plus a horizontal alignment (left/center/right).",
        "",
        "Rules by layout:",
        "- talking_head: bottom/center. The face is the thing to protect.",
        "- screen_with_webcam: the webcam inset is the speaker's face and must never be covered.",
        "  Pick the band and alignment furthest from it that is not sitting on the content the",
        "  viewer is meant to read. If the webcam is in a bottom corner, prefer the opposite",
        "  bottom corner; only use top if the lower half is dense everywhere.",
        "- screen_only / other: pick the emptiest band, preferring bottom.",
        "",
        "Never choose the very top if a browser tab or address bar is there, and never a zone",
        "covering a chart, headline, or the tweet/post currently being discussed.",
        "Answer for every image, in order, using its 1-based position as `index`.",
      ].join("\n"),
    },
  ];
  for (const sample of samples) {
    const bytes = await fsp.readFile(sample.framePath);
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${bytes.toString("base64")}`, detail: "low" },
    });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "placements",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["placements"],
            properties: {
              placements: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["index", "layout", "band", "align", "reason"],
                  properties: {
                    index: { type: "integer" },
                    layout: {
                      type: "string",
                      enum: ["talking_head", "screen_with_webcam", "screen_only", "other"],
                    },
                    band: { type: "string", enum: ["top", "center", "bottom"] },
                    align: { type: "string", enum: ["left", "center", "right"] },
                    reason: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Placement analysis failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as OpenAIResponse;
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Placement analysis returned no content");
  const parsed = JSON.parse(raw) as {
    placements?: { index: number; band: CaptionBand; align: CaptionAlign; layout: string; reason: string }[];
  };

  return (parsed.placements ?? []).map((p) => ({
    // The model answers with 1-based image positions; map back to shots.
    index: samples[p.index - 1]?.index ?? -1,
    band: p.band,
    align: p.align ?? "center",
    layout: p.layout,
    reason: p.reason,
  }));
}

/**
 * Suppress moves that would make the band twitch. A band change only sticks
 * if the shot is long enough to be worth it; otherwise the previous band
 * carries through and adjacent same-band segments are merged.
 */
function applyHysteresis(
  shots: { startSec: number; endSec: number }[],
  verdicts: Map<number, BandVerdict>,
  fallback: { band: CaptionBand; align: CaptionAlign }
): PlacementSegment[] {
  const segments: PlacementSegment[] = [];
  const first = verdicts.get(0);
  let current: { band: CaptionBand; align: CaptionAlign } = first
    ? { band: first.band, align: first.align }
    : fallback;
  let reason = first?.reason;
  let layout = first?.layout;

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const verdict = verdicts.get(i);
    const longEnough = shot.endSec - shot.startSec >= MIN_SHOT_FOR_MOVE_SEC;
    const differs = verdict && (verdict.band !== current.band || verdict.align !== current.align);

    if (verdict && differs && longEnough) {
      current = { band: verdict.band, align: verdict.align };
      reason = verdict.reason;
      layout = verdict.layout;
    }

    const previous = segments.at(-1);
    if (previous && previous.band === current.band && previous.align === current.align) {
      previous.endSec = shot.endSec;
    } else {
      segments.push({
        startSec: shot.startSec,
        endSec: shot.endSec,
        band: current.band,
        align: current.align,
        reason,
        layout,
      });
    }
  }

  return segments;
}

export interface PlacementOptions {
  /** Skip the vision pass entirely and pin captions to the bottom band. */
  fixedBand?: CaptionBand;
  fixedAlign?: CaptionAlign;
  onWarn?: (message: string) => void;
  onProgress?: (message: string) => void;
}

export async function planPlacement(
  source: SourceMeta,
  options: PlacementOptions = {}
): Promise<PlacementSegment[]> {
  const fallback: PlacementSegment[] = [
    {
      startSec: 0,
      endSec: source.durationSec,
      band: "bottom",
      align: "center",
      reason: "default lower-third",
    },
  ];

  if (options.fixedBand) {
    return [
      {
        startSec: 0,
        endSec: source.durationSec,
        band: options.fixedBand,
        align: options.fixedAlign ?? "center",
        reason: "fixed by --band",
      },
    ];
  }

  let shots: { startSec: number; endSec: number }[];
  try {
    const boundaries = await detectShotBoundaries(source.path);
    shots = selectShots(subdivide(buildShots(boundaries, source.durationSec), source.durationSec));
    options.onProgress?.(`${shots.length} shot(s) sampled for placement`);
  } catch (error) {
    options.onWarn?.(
      `shot detection failed, using default bottom band: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return fallback;
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "viralframe-placement-"));
  try {
    const samples: ShotSample[] = [];
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      // A third of the way in avoids both the transition and any dissolve.
      const atSec = shot.startSec + (shot.endSec - shot.startSec) / 3;
      const framePath = path.join(tempDir, `shot-${i}.jpg`);
      await extractFrame(source.path, atSec, framePath);
      samples.push({ index: i, startSec: shot.startSec, endSec: shot.endSec, atSec, framePath });
    }

    const verdicts = new Map<number, BandVerdict>();
    for (const verdict of await classifyFrames(samples)) {
      if (verdict.index >= 0) verdicts.set(verdict.index, verdict);
    }
    if (verdicts.size === 0) {
      options.onWarn?.("placement model returned no usable verdicts; using default bottom band");
      return fallback;
    }

    return applyHysteresis(shots, verdicts, { band: "bottom", align: "center" });
  } catch (error) {
    options.onWarn?.(
      `placement analysis failed, using default bottom band: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return fallback;
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}
