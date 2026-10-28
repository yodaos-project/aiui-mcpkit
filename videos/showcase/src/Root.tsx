import { Composition } from "remotion";
import { Main } from "./Main";
import { TOTAL } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MCPKitShowcase"
        component={Main}
        durationInFrames={TOTAL}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ bgm: true }}
      />
    </>
  );
};
