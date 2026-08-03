import { Composition } from "remotion";
import { ReelComposition, type ReelCompositionProps } from "./ReelComposition";
import { CaptionedVideo, type CaptionedVideoProps } from "./CaptionedVideo";

const FPS = 30;
const DIMENSIONS: Record<ReelCompositionProps["aspectRatio"], { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

const defaultProps: ReelCompositionProps = {
  creatorVideoSrc: "",
  brollClips: [],
  words: [],
  hook: "",
  layout: "top",
  captionStyle: "Minimal",
  durationInSeconds: 30,
  aspectRatio: "9:16",
};

const captionedDefaults: CaptionedVideoProps = {
  videoSrc: "",
  cards: [],
  placement: [],
  styleId: "hormozi",
  durationInSeconds: 30,
  fps: 30,
  width: 1920,
  height: 1080,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="Reel"
      component={ReelComposition}
      fps={FPS}
      width={DIMENSIONS["9:16"].width}
      height={DIMENSIONS["9:16"].height}
      durationInFrames={FPS * defaultProps.durationInSeconds}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: Math.max(1, Math.round(props.durationInSeconds * FPS)),
        ...DIMENSIONS[props.aspectRatio],
      })}
    />
    <Composition
      id="CaptionedVideo"
      component={CaptionedVideo}
      fps={captionedDefaults.fps}
      width={captionedDefaults.width}
      height={captionedDefaults.height}
      durationInFrames={captionedDefaults.fps * captionedDefaults.durationInSeconds}
      defaultProps={captionedDefaults}
      // Geometry and frame rate come from the source file's own ffprobe
      // metadata rather than a preset, so nothing is rescaled or resampled.
      calculateMetadata={async ({ props }) => ({
        durationInFrames: Math.max(1, Math.round(props.durationInSeconds * props.fps)),
        fps: props.fps,
        width: props.width,
        height: props.height,
      })}
    />
    </>
  );
};
