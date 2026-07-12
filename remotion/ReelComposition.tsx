import type { CSSProperties } from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export interface BrollClipProps {
  sceneIndex: number;
  startSec: number;
  endSec: number;
  src: string;
}

export interface TranscriptWordProps {
  word: string;
  start: number;
  end: number;
}

export interface ReelCompositionProps {
  creatorVideoSrc: string;
  brollClips: BrollClipProps[];
  words: TranscriptWordProps[];
  hook: string;
  // "cutaway": full-screen creator video throughout, with brief full-screen
  // b-roll takeovers only during each clip's window -- restrained b-roll at
  // a few key moments instead of a permanent split-screen. Cheaper (far
  // fewer clips needed) and, per real short-form editing conventions,
  // arguably more authentic-looking than constant split-screen too.
  layout: "top" | "bottom" | "full" | "cutaway";
  captionStyle: string;
  durationInSeconds: number;
  // "top"/"bottom" split layouts are only meaningful in portrait -- in
  // landscape they'd letterbox into two thin strips, so that combination
  // isn't supported; use "cutaway" or "full" for landscape output instead.
  aspectRatio: "9:16" | "16:9";
  // Remotion's Composition/renderMedia typings require input props to
  // satisfy Record<string, unknown>.
  [key: string]: unknown;
}

function BrollTrack({
  clips,
  fullScreen = false,
}: {
  clips: BrollClipProps[];
  fullScreen?: boolean;
}) {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {clips.map((clip) => {
        const from = Math.round(clip.startSec * fps);
        const durationInFrames = Math.max(1, Math.round((clip.endSec - clip.startSec) * fps));
        return (
          <Sequence key={clip.sceneIndex} from={from} durationInFrames={durationInFrames}>
            <OffthreadVideo
              src={clip.src}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {fullScreen && (
              <AbsoluteFill
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.35) 100%)",
                }}
              />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

// Base = context words either side of the active one; active = the
// karaoke-highlighted word currently being spoken. This "one word popped,
// rest dimmed" look is the common thread across CapCut/Opus/Submagic-style
// auto-captions and Hormozi-style creator captions alike.
interface CaptionStyleConfig {
  base: CSSProperties;
  active: CSSProperties;
}

const CAPTION_STYLES: Record<string, CaptionStyleConfig> = {
  "Hormozi style": {
    base: {
      fontWeight: 900,
      color: "white",
      textTransform: "uppercase",
      WebkitTextStroke: "0.045em black",
      letterSpacing: -1,
    },
    active: {
      fontWeight: 900,
      color: "#FFD400",
      textTransform: "uppercase",
      WebkitTextStroke: "0.045em black",
      letterSpacing: -1,
    },
  },
  Minimal: {
    base: {
      fontWeight: 500,
      color: "rgba(255,255,255,0.7)",
    },
    active: {
      fontWeight: 600,
      color: "white",
    },
  },
  "News style": {
    base: {
      fontWeight: 700,
      color: "rgba(255,255,255,0.8)",
    },
    active: {
      fontWeight: 800,
      color: "#FFD400",
    },
  },
  Podcast: {
    base: {
      fontWeight: 600,
      color: "rgba(255,255,255,0.75)",
    },
    active: {
      fontWeight: 700,
      color: "white",
    },
  },
};

const CAPTION_BACKDROP: Record<string, CSSProperties> = {
  "Hormozi style": {},
  Minimal: { background: "rgba(0,0,0,0.55)", borderRadius: 8 },
  "News style": { background: "#B91C1C" },
  Podcast: { background: "rgba(0,0,0,0.7)", borderRadius: 999 },
};

const POP_IN_SECONDS = 0.15;

function CaptionOverlay({
  words,
  captionStyle,
}: {
  words: TranscriptWordProps[];
  captionStyle: string;
}) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const fontSize = width * 0.06;

  const currentIndex = words.findIndex((w) => t >= w.start && t < w.end);
  if (currentIndex === -1) return null;

  const windowStart = Math.max(0, currentIndex - 1);
  const windowWords = words.slice(windowStart, windowStart + 3);
  const { base, active } = CAPTION_STYLES[captionStyle] ?? CAPTION_STYLES.Minimal;
  const backdrop = CAPTION_BACKDROP[captionStyle] ?? CAPTION_BACKDROP.Minimal;

  const activeWord = words[currentIndex];
  const popProgress = Math.min(1, (t - activeWord.start) / POP_IN_SECONDS);
  const activeScale = interpolate(popProgress, [0, 1], [1.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: "22%" }}>
      <div
        style={{
          display: "flex",
          gap: fontSize * 0.3,
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          maxWidth: "85%",
          padding: "0.3em 0.6em",
          ...backdrop,
        }}
      >
        {windowWords.map((w, i) => {
          const isActive = windowStart + i === currentIndex;
          return (
            <span
              key={windowStart + i}
              style={{
                ...(isActive ? active : base),
                fontSize,
                lineHeight: 1.15,
                display: "inline-block",
                transform: isActive ? `scale(${activeScale})` : "scale(1)",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function HookOverlay({ hook }: { hook: string }) {
  const { width } = useVideoConfig();
  if (!hook) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: "7%" }}>
      <div
        style={{
          maxWidth: "80%",
          background: "rgba(0,0,0,0.7)",
          borderRadius: 16,
          padding: "0.4em 0.6em",
          textAlign: "center",
          color: "white",
          fontWeight: 800,
          fontSize: width * 0.037,
          textTransform: "uppercase",
          lineHeight: 1.2,
        }}
      >
        {hook}
      </div>
    </AbsoluteFill>
  );
}

export function ReelComposition({
  creatorVideoSrc,
  brollClips,
  words,
  hook,
  layout,
  captionStyle,
}: ReelCompositionProps) {
  const creatorVideo = (
    <OffthreadVideo src={creatorVideoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );

  if (layout === "full") {
    return (
      <AbsoluteFill style={{ backgroundColor: "black" }}>
        {creatorVideo}
        <HookOverlay hook={hook} />
        <CaptionOverlay words={words} captionStyle={captionStyle} />
      </AbsoluteFill>
    );
  }

  if (layout === "cutaway") {
    return (
      <AbsoluteFill style={{ backgroundColor: "black" }}>
        {creatorVideo}
        {/* Layered on top -- opaque, so it visually covers the creator
            video only during each clip's own Sequence window, then reveals
            the creator video again once the clip ends. */}
        <BrollTrack clips={brollClips} fullScreen />
        <HookOverlay hook={hook} />
        <CaptionOverlay words={words} captionStyle={captionStyle} />
      </AbsoluteFill>
    );
  }

  const brollFirst = layout === "top";

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "50%",
          top: brollFirst ? 0 : "50%",
          overflow: "hidden",
        }}
      >
        <BrollTrack clips={brollClips} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "50%",
          top: brollFirst ? "50%" : 0,
          overflow: "hidden",
        }}
      >
        {creatorVideo}
      </div>
      <HookOverlay hook={hook} />
      <CaptionOverlay words={words} captionStyle={captionStyle} />
    </AbsoluteFill>
  );
}
