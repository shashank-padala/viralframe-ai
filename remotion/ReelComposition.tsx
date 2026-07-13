import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig } from "remotion";

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
  hook,
  layout,
}: ReelCompositionProps) {
  const creatorVideo = (
    <OffthreadVideo src={creatorVideoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );

  if (layout === "full") {
    return (
      <AbsoluteFill style={{ backgroundColor: "black" }}>
        {creatorVideo}
        <HookOverlay hook={hook} />
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
    </AbsoluteFill>
  );
}
