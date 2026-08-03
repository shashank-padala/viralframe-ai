import type { CSSProperties } from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", { weights: ["800", "900"], subsets: ["latin"] });

// Full-frame captioned render. Deliberately separate from `ReelComposition`
// rather than another layout branch inside it: that one exists to composite
// b-roll into a 9:16 reel, this one leaves a 16:9 long-form video untouched
// and only draws text over it.

export type CaptionBandProp = "top" | "center" | "bottom";
export type CaptionAlignProp = "left" | "center" | "right";

export interface CaptionWordProps {
  text: string;
  startSec: number;
  endSec: number;
  highlight: boolean;
}

export interface CaptionCardProps {
  index: number;
  startSec: number;
  endSec: number;
  words: CaptionWordProps[];
}

export interface PlacementSegmentProps {
  startSec: number;
  endSec: number;
  band: CaptionBandProp;
  /** Absent means centered, which is what documents predating this field expect. */
  align?: CaptionAlignProp;
}

export interface CaptionedVideoProps {
  videoSrc: string;
  cards: CaptionCardProps[];
  placement: PlacementSegmentProps[];
  styleId: string;
  durationInSeconds: number;
  // Output geometry mirrors the source exactly rather than being snapped to
  // a preset, so a 16:9 upload comes back at its original resolution and a
  // 60fps screen recording is not silently halved to 30.
  fps: number;
  width: number;
  height: number;
  // Remotion requires props to be indexable; see the note in
  // scripts/pipeline/steps/render.ts about why callers use Pick, not Omit.
  [key: string]: unknown;
}

interface CaptionStyle {
  base: CSSProperties;
  highlight: CSSProperties;
  backdrop?: CSSProperties;
  /** Font size as a fraction of the frame's short edge. */
  sizeRatio: number;
  uppercase: boolean;
}

const STYLES: Record<string, CaptionStyle> = {
  // The CapCut/Hormozi look: heavy uppercase, thick black outline so it
  // survives any background, one word in yellow.
  hormozi: {
    base: { color: "#FFFFFF", fontWeight: 900 },
    highlight: { color: "#FFD400", fontWeight: 900 },
    sizeRatio: 0.058,
    uppercase: true,
  },
  clean: {
    base: { color: "#FFFFFF", fontWeight: 800 },
    highlight: { color: "#FFD400", fontWeight: 800 },
    backdrop: { background: "rgba(0,0,0,0.6)", borderRadius: 12 },
    sizeRatio: 0.05,
    uppercase: false,
  },
};

const POP_IN_SEC = 0.12;

function zoneFor(
  placement: PlacementSegmentProps[],
  t: number
): { band: CaptionBandProp; align: CaptionAlignProp } {
  const active =
    placement.find((s) => t >= s.startSec && t < s.endSec) ?? placement[placement.length - 1];
  return { band: active?.band ?? "bottom", align: active?.align ?? "center" };
}

function bandStyle(band: CaptionBandProp): CSSProperties {
  switch (band) {
    case "top":
      return { justifyContent: "flex-start", paddingTop: "9%" };
    case "center":
      return { justifyContent: "center" };
    default:
      // Clear of YouTube's progress bar and control chrome, which occupy
      // roughly the bottom 8-10% while the player UI is visible.
      return { justifyContent: "flex-end", paddingBottom: "12%" };
  }
}

function alignStyle(align: CaptionAlignProp): CSSProperties {
  switch (align) {
    case "left":
      return { alignItems: "flex-start", paddingLeft: "5%", paddingRight: "5%" };
    case "right":
      return { alignItems: "flex-end", paddingLeft: "5%", paddingRight: "5%" };
    default:
      return { alignItems: "center" };
  }
}

function CaptionLayer({
  cards,
  placement,
  styleId,
}: {
  cards: CaptionCardProps[];
  placement: PlacementSegmentProps[];
  styleId: string;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const card = cards.find((c) => t >= c.startSec && t < c.endSec);
  if (!card) return null;

  const style = STYLES[styleId] ?? STYLES.hormozi;
  // Size off the short edge so the same ratio reads correctly in both 16:9
  // and 9:16. Sizing off width (as the reel composition does) yields ~110px
  // text on a 1920-wide frame, which is enormous.
  const fontSize = Math.min(width, height) * style.sizeRatio;

  const popProgress = interpolate(t - card.startSec, [0, POP_IN_SEC], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(popProgress, [0, 1], [0.88, 1]);

  const zone = zoneFor(placement, t);
  // An off-centre caption has to stay in its own half, otherwise it grows
  // back across the very region the alignment was chosen to avoid -- a
  // bottom-left zone picked to dodge a bottom-right webcam is pointless if
  // a long card still reaches 82% of the width.
  const maxWidth = zone.align === "center" ? "82%" : "52%";

  return (
    <AbsoluteFill style={{ ...bandStyle(zone.band), ...alignStyle(zone.align) }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: zone.align === "right" ? "flex-end" : zone.align === "left" ? "flex-start" : "center",
          alignItems: "baseline",
          gap: `${fontSize * 0.28}px`,
          maxWidth,
          padding: style.backdrop ? `${fontSize * 0.25}px ${fontSize * 0.5}px` : undefined,
          transform: `scale(${scale})`,
          opacity: popProgress,
          ...style.backdrop,
        }}
      >
        {card.words.map((word, i) => (
          <span
            key={i}
            style={{
              fontFamily,
              fontSize,
              lineHeight: 1.12,
              letterSpacing: "-0.01em",
              textTransform: style.uppercase ? "uppercase" : "none",
              // Stroke alone disappears against a bright, busy background
              // like a scrolling social feed; the shadow underneath gives
              // the text an edge to sit on regardless of what's behind it.
              WebkitTextStroke: `${fontSize * 0.055}px #000000`,
              paintOrder: "stroke fill",
              textShadow: `0 ${fontSize * 0.05}px ${fontSize * 0.12}px rgba(0,0,0,0.55)`,
              ...(word.highlight ? style.highlight : style.base),
            }}
          >
            {word.text}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}

export function CaptionedVideo({ videoSrc, cards, placement, styleId }: CaptionedVideoProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <CaptionLayer cards={cards} placement={placement} styleId={styleId} />
    </AbsoluteFill>
  );
}
