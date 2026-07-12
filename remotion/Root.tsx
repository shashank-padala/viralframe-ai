import { Composition } from "remotion";
import { ReelComposition, type ReelCompositionProps } from "./ReelComposition";

const FPS = 30;

const defaultProps: ReelCompositionProps = {
  creatorVideoSrc: "",
  brollClips: [],
  words: [],
  hook: "",
  layout: "top",
  captionStyle: "Minimal",
  durationInSeconds: 30,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={ReelComposition}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={FPS * defaultProps.durationInSeconds}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: Math.max(1, Math.round(props.durationInSeconds * FPS)),
      })}
    />
  );
};
