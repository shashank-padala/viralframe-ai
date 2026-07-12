import { Composition } from "remotion";
import { ReelComposition, type ReelCompositionProps } from "./ReelComposition";

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

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
