import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  ConversationClaim,
  InConversation,
  OpenIndependently,
  BackToConversation,
  InterfaceRange,
  ConversationFinale,
  CrossPlatform,
} from "./ConversationFilm";
import { SHOTS, SFX, TOTAL, beatF } from "./timeline";

export const Music = ({ volume = 0.5 }: { volume?: number }) => {
  const f = useCurrentFrame();
  return (
    <Audio
      src={staticFile("audio/cat-walk.wav")}
      volume={interpolate(f, [0, beatF(70), TOTAL], [volume, volume, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })}
    />
  );
};
export const Main = ({ bgm = true }: { bgm?: boolean }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Sequence
        name="Claim"
        from={SHOTS.claim.from}
        durationInFrames={SHOTS.claim.duration}
        premountFor={fps}
      >
        <ConversationClaim />
      </Sequence>
      <Sequence
        name="In Codex conversation"
        from={SHOTS.chat.from}
        durationInFrames={SHOTS.chat.duration}
        premountFor={fps}
      >
        <InConversation />
      </Sequence>
      <Sequence
        name="Open independent view"
        from={SHOTS.expand.from}
        durationInFrames={SHOTS.expand.duration}
        premountFor={fps}
      >
        <OpenIndependently />
      </Sequence>
      <Sequence
        name="Return to conversation"
        from={SHOTS.back.from}
        durationInFrames={SHOTS.back.duration}
        premountFor={fps}
      >
        <BackToConversation />
      </Sequence>
      <Sequence
        name="Interface range"
        from={SHOTS.range.from}
        durationInFrames={SHOTS.range.duration}
        premountFor={fps}
      >
        <InterfaceRange />
      </Sequence>
      <Sequence
        name="Desktop agents and Rokid Glasses"
        from={SHOTS.platforms.from}
        durationInFrames={SHOTS.platforms.duration}
        premountFor={fps}
      >
        <CrossPlatform />
      </Sequence>
      <Sequence
        name="Brand"
        from={SHOTS.finale.from}
        durationInFrames={SHOTS.finale.duration}
        premountFor={fps}
      >
        <ConversationFinale />
      </Sequence>
      {bgm ? <Music /> : null}
      {SFX.map((cue, i) => (
        <Sequence
          key={i}
          name={cue.src}
          from={cue.from}
          durationInFrames={cue.duration}
          premountFor={fps}
        >
          <Audio src={staticFile(`audio/${cue.src}`)} volume={cue.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
