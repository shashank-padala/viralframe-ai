import type { CSSProperties } from "react";
import { AbsoluteFill, Sequence, Video, useCurrentFrame, useVideoConfig } from "remotion";

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
            <Video
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

const CAPTION_STYLES: Record<string, CSSProperties> = {
  "Hormozi style": {
    fontWeight: 900,
    fontSize: 64,
    color: "#FFD400",
    textTransform: "uppercase",
    WebkitTextStroke: "3px black",
    letterSpacing: -1,
  },
  Minimal: {
    fontWeight: 500,
    fontSize: 44,
    color: "white",
    background: "rgba(0,0,0,0.55)",
    padding: "8px 20px",
    borderRadius: 8,
  },
  "News style": {
    fontWeight: 700,
    fontSize: 48,
    color: "white",
    background: "#B91C1C",
    padding: "10px 28px",
  },
  Podcast: {
    fontWeight: 600,
    fontSize: 46,
    color: "white",
    background: "rgba(0,0,0,0.7)",
    padding: "10px 32px",
    borderRadius: 999,
  },
};

function CaptionOverlay({
  words,
  captionStyle,
}: {
  words: TranscriptWordProps[];
  captionStyle: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const currentIndex = words.findIndex((w) => t >= w.start && t < w.end);
  if (currentIndex === -1) return null;

  const windowStart = Math.max(0, currentIndex - 1);
  const text = words
    .slice(windowStart, windowStart + 3)
    .map((w) => w.word)
    .join(" ");

  const style = CAPTION_STYLES[captionStyle] ?? CAPTION_STYLES.Minimal;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 220 }}>
      <div style={{ ...style, textAlign: "center", maxWidth: "85%", lineHeight: 1.15 }}>{text}</div>
    </AbsoluteFill>
  );
}

function HookOverlay({ hook }: { hook: string }) {
  if (!hook) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 140 }}>
      <div
        style={{
          maxWidth: "80%",
          background: "rgba(0,0,0,0.7)",
          borderRadius: 16,
          padding: "16px 24px",
          textAlign: "center",
          color: "white",
          fontWeight: 800,
          fontSize: 40,
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
    <Video src={creatorVideoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
