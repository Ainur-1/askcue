import { Composition } from "remotion";
import { AskCueDemo } from "./AskCueDemo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="AskCueDemo"
      component={AskCueDemo}
      durationInFrames={1350}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
