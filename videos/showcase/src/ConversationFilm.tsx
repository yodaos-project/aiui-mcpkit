import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { localBeat, SHOTS } from "./timeline";

const PAPER = "#f4f4ef",
  INK = "#101010",
  BLUE = "#245dd8";
const FONT = 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.6, 0, 0.18, 1);
const ramp = (f: number, start: number, length: number, easing = ease) =>
  interpolate(f, [start, start + length], [0, 1], { ...clamp, easing });
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const root: CSSProperties = {
  fontFamily: FONT,
  color: INK,
  backgroundColor: PAPER,
  overflow: "hidden",
};
type Rect = { x: number; y: number; w: number; h: number };
export const CARD: Rect = { x: 720, y: 350, w: 1014, h: 584 };
export const FULL: Rect = { x: 460, y: 90, w: 1380, h: 917 };
const interpolateRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
  w: mix(a.w, b.w, t),
  h: mix(a.h, b.h, t),
});
const texture = (file: string) => staticFile(`textures/${file}.png`);

const Masthead = ({ dark = false }: { dark?: boolean }) => (
  <div
    style={{
      position: "absolute",
      left: 80,
      top: 50,
      color: dark ? PAPER : INK,
      fontSize: 44,
      fontWeight: 800,
      letterSpacing: -1,
    }}
  >
    AIUI MCPKit
  </div>
);

// The host shell and dialogue are explicitly approved illustrations. The canvas
// images inside the app card come from one real View across both display modes.
const ConversationShell = ({ opacity = 1 }: { opacity?: number }) => (
  <div
    style={{
      position: "absolute",
      left: 650,
      top: 90,
      width: 1180,
      height: 900,
      border: "2px solid #d6d6d0",
      borderRadius: 14,
      backgroundColor: "#fff",
      boxShadow: "0 24px 80px #10101012",
      opacity,
    }}
  >
    <div
      style={{
        height: 64,
        borderBottom: "1px solid #d6d6d0",
        padding: "8px 26px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 44, fontWeight: 800 }}>Codex</span>
      <span style={{ fontSize: 44, color: "#777" }}>UI illustration</span>
    </div>
    <div
      style={{
        position: "absolute",
        right: 44,
        top: 94,
        width: 800,
        padding: "20px 28px",
        backgroundColor: "#f0f0ed",
        borderRadius: 20,
        fontSize: 40,
        lineHeight: 1.35,
      }}
    >
      Plan two days in Kyoto.
    </div>

    <div
      style={{
        position: "absolute",
        left: 66,
        bottom: 9,
        width: 1014,
        height: 44,
        paddingTop: 4,
        borderTop: "2px solid #ddd",
        fontSize: 44,
        color: "#92928c",
      }}
    >
      Ask a follow-up…
    </div>
  </div>
);

export const AppPanel = ({
  rect,
  mode,
  inlineFile = "inline-bamboo",
  fullFile = "expanded-bamboo",
  p = mode === "full" ? 1 : 0,
}: {
  rect: Rect;
  mode?: "inline" | "full";
  inlineFile?: string;
  fullFile?: string;
  p?: number;
}) => {
  const border = 2,
    bar = 50;
  const newFace = Math.min(1, p * 3.6);
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        boxSizing: "border-box",
        border: `${border}px solid #d6d6d0`,
        borderRadius: mix(8, 12, p),
        overflow: "hidden",
        backgroundColor: "#edf3fb",
        boxShadow: "0 20px 60px #10101012",
      }}
    >
      <div
        style={{
          height: bar,
          padding: "2px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #d6d6d0",
          fontSize: 44,
          fontWeight: 700,
          color: INK,
          backgroundColor: "#fff",
          whiteSpace: "nowrap",
        }}
      >
        <span>{p > 0.5 ? "Independent view" : "Trip planner"}</span>
        <span>{p > 0.5 ? "Back to chat ↙" : "Expand ↗"}</span>
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: rect.h - border * 2 - bar,
          overflow: "hidden",
        }}
      >
        <Img
          src={texture(fullFile)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: newFace,
          }}
        />
        <Img
          src={texture(inlineFile)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 1 - newFace,
          }}
        />
      </div>
    </div>
  );
};

type Click = { at: number; x: number; y: number };
// Resource-free pointer: solid CSS polygons in composition pixels. No image,
// SVG, filter, CSS zoom or transform ancestry can cause compositor dropouts.
const Pointer = ({
  clicks,
  color = BLUE,
}: {
  clicks: Click[];
  color?: string;
}) => {
  const f = useCurrentFrame();
  let x = 1880,
    y = 1000,
    press = 0;
  for (const click of clicks) {
    const p = ramp(f, click.at - 24, 20);
    const dx = click.x - x,
      dy = click.y - y;
    const length = Math.max(1, Math.hypot(dx, dy)),
      bow = Math.sin(Math.PI * p) * Math.min(70, length * 0.1);
    x += dx * p - (dy / length) * bow;
    y += dy * p + (dx / length) * bow;
    if (f >= click.at - 2 && f < click.at + 7)
      press =
        f < click.at + 1
          ? ramp(f, click.at - 2, 3)
          : 1 - ramp(f, click.at + 1, 6);
  }
  const visibility =
    ramp(f, clicks[0].at - 24, 6) *
    (1 - ramp(f, clicks[clicks.length - 1].at + 15, 8));
  const w = 44 * (1 - 0.16 * press),
    h = 54 * (1 - 0.16 * press);
  const polygon = "polygon(0 0,0 86%,28% 64%,50% 100%,70% 90%,48% 54%,88% 54%)";
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          zIndex: 20,
          opacity: visibility,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: polygon,
            backgroundColor: "#fff",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 2,
            top: 4,
            width: w - 6,
            height: h - 7,
            clipPath: polygon,
            backgroundColor: INK,
          }}
        />
      </div>
      {clicks.map((c) => {
        const p = ramp(f, c.at, 18),
          d = 76 * (0.3 + p * 1.2);
        return f < c.at || f >= c.at + 18 ? null : (
          <div
            key={c.at}
            style={{
              position: "absolute",
              left: c.x - d / 2,
              top: c.y - d / 2,
              width: d,
              height: d,
              borderRadius: "50%",
              border: `3px solid ${color}`,
              opacity: 1 - p,
              zIndex: 19,
            }}
          />
        );
      })}
    </>
  );
};

const ChatHeadline = ({
  title = "Right in\nyour chat.",
  caption = "Make it yours.",
  opacity = 1,
}: {
  title?: string;
  caption?: string;
  opacity?: number;
}) => (
  <div
    style={{ position: "absolute", left: 80, top: 285, width: 560, opacity }}
  >
    <div
      style={{
        fontSize: 110,
        fontWeight: 800,
        lineHeight: 1.03,
        letterSpacing: -4,
        whiteSpace: "pre-line",
      }}
    >
      {title}
    </div>
    <div
      style={{
        fontSize: 80,
        color: BLUE,
        whiteSpace: "pre-line",
        lineHeight: 1.25,
        marginTop: 42,
        letterSpacing: -2,
      }}
    >
      {caption}
    </div>
  </div>
);
const ExpandedHeadline = ({ opacity = 1 }: { opacity?: number }) => (
  <div
    style={{
      position: "absolute",
      left: 80,
      top: 310,
      width: 355,
      opacity,
      color: PAPER,
    }}
  >
    <div
      style={{
        fontSize: 104,
        fontWeight: 800,
        lineHeight: 1.03,
        letterSpacing: -4,
      }}
    >
      More
      <br />
      room.
    </div>
  </div>
);

export const ConversationClaim = ({
  title = "An idea.\nNow in view.",
}: {
  title?: string;
}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ ...root, backgroundColor: INK, color: PAPER }}>
      <Masthead dark />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 240,
          height: 510,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 190,
            fontWeight: 800,
            letterSpacing: -6,
            lineHeight: 1.05,
            whiteSpace: "pre-line",
          }}
        >
          {title.split("\n").map((line, i) => (
            <div key={i} style={{ overflow: "hidden" }}>
              <div
                style={{
                  translate: `0 ${(1 - ramp(f, localBeat("claim", i === 0 ? 1 : 3), localBeat("claim", 2) - localBeat("claim", 1))) * 230}px`,
                }}
              >
                {line}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          bottom: 90,
          width:
            670 *
            ramp(
              f,
              localBeat("claim", 5),
              localBeat("claim", 6) - localBeat("claim", 5),
            ),
          height: 180,
          backgroundColor: BLUE,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 60,
            top: 44,
            width: 610,
            fontSize: 78,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          Put it to work.
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const InConversation = () => {
  const f = useCurrentFrame();
  const file =
    f < localBeat("chat", 12) + 2
      ? "inline-start"
      : f < localBeat("chat", 16) + 2
        ? "inline-day2"
        : "inline-bamboo";
  return (
    <AbsoluteFill style={root}>
      <Masthead />
      <ChatHeadline />
      <ConversationShell />
      <AppPanel rect={CARD} inlineFile={file} p={0} />
      <Pointer
        clicks={[
          { at: localBeat("chat", 12), x: 928.8, y: 657.4 },
          { at: localBeat("chat", 16), x: 1371.3, y: 520.3 },
          { at: localBeat("chat", 19), x: 1668, y: 375 },
        ]}
      />
    </AbsoluteFill>
  );
};

export const OpenIndependently = () => {
  const f = useCurrentFrame(),
    p = ramp(f, 0, localBeat("expand", 24), Easing.bezier(0.7, 0, 0.3, 1));
  const rect = interpolateRect(CARD, FULL, p),
    file =
      f < localBeat("expand", 27) + 2 ? "expanded-bamboo" : "expanded-garden";
  return (
    <AbsoluteFill style={root}>
      <Masthead />
      <ChatHeadline opacity={1 - ramp(f, 0, localBeat("expand", 21))} />
      <ConversationShell opacity={1 - p} />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: 1920 * p,
          backgroundColor: BLUE,
        }}
      />

      <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${1920 * (1 - p)}px)` }}>
        <Masthead dark />
      </AbsoluteFill>
      <ExpandedHeadline
        opacity={ramp(
          f,
          localBeat("expand", 23),
          localBeat("expand", 24) - localBeat("expand", 23),
        )}
      />
      <AppPanel rect={rect} p={p} fullFile={file} />
      {f >= localBeat("expand", 25) ? (
        <Pointer
          clicks={[
            { at: localBeat("expand", 27), x: 1356.4, y: 650.9 },
            { at: localBeat("expand", 31), x: 1734, y: 118 },
          ]}
          color={PAPER}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const BackToConversation = () => {
  const f = useCurrentFrame(),
    p = ramp(f, 0, localBeat("back", 35), Easing.bezier(0.7, 0, 0.3, 1));
  return (
    <AbsoluteFill style={{ ...root, backgroundColor: BLUE }}>
      <Masthead dark />
      <ExpandedHeadline opacity={1 - p} />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 1920 * p,
          backgroundColor: PAPER,
        }}
      />

      <AbsoluteFill style={{ clipPath: `inset(0 ${1920 * (1 - p)}px 0 0)` }}>
        <Masthead />
      </AbsoluteFill>
      <ChatHeadline
        title={"Just as\nyou left it."}
        caption=""
        opacity={ramp(
          f,
          localBeat("back", 35),
          localBeat("back", 36) - localBeat("back", 35),
        )}
      />
      <ConversationShell opacity={p} />
      <AppPanel
        rect={interpolateRect(FULL, CARD, p)}
        p={1 - p}
        inlineFile="inline-garden"
        fullFile="expanded-garden"
      />
    </AbsoluteFill>
  );
};

export const InterfaceRange = ({
  title = "Small apps.\nBig possibilities.",
}: {
  title?: string;
}) => {
  const f = useCurrentFrame();
  const cards = [
    {
      file: "inline-bamboo",
      title: "Trip planner",
      x: 800,
      y: 170,
      w: 500,
      rot: 0,
    },
    {
      file: "focus-inline",
      title: "Focus timer",
      x: 1340,
      y: 170,
      w: 500,
      rot: 0,
    },
    {
      file: "analytics-inline",
      title: "Analytics",
      x: 800,
      y: 580,
      w: 500,
      rot: 0,
    },
    {
      file: "events-inline",
      title: "Workshop",
      x: 1340,
      y: 580,
      w: 500,
      rot: 0,
    },
  ];
  return (
    <AbsoluteFill style={{ ...root, backgroundColor: INK, color: PAPER }}>
      <Masthead dark />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 280,
          width: 680,
          fontSize: 90,
          lineHeight: 1.06,
          letterSpacing: -3,
          fontWeight: 800,
          whiteSpace: "pre-line",
        }}
      >
        {title}
      </div>

      {cards.map((c, i) => {
        const p = ramp(
          f,
          localBeat("range", 40 + i),
          localBeat("range", 42 + i) - localBeat("range", 40 + i),
        );
        return (
          <div
            key={c.file}
            style={{
              position: "absolute",
              left: c.x + (1 - p) * 1100,
              top: c.y,
              width: c.w,
              border: "2px solid #fff",
              borderRadius: 10,
              overflow: "hidden",
              rotate: `${c.rot * p}deg`,
              backgroundColor: "#fff",
              boxShadow: "0 16px 40px #0003",
            }}
          >
            <div
              style={{
                height: 52,
                fontSize: 46,
                lineHeight: 1,
                color: INK,
                padding: "3px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: 700,
              }}
            >
              <span>{c.title}</span>
            </div>
            <Img
              src={texture(c.file)}
              style={{ display: "block", width: "100%" }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const ConversationFinale = ({
  tagline = "Your ideas.\nA wider world.",
}: {
  tagline?: string;
}) => {
  const f = useCurrentFrame(),
    p = ramp(f, 0, localBeat("finale", 62));
  return (
    <AbsoluteFill style={{ ...root, backgroundColor: INK, color: PAPER }}>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 930 * p,
          backgroundColor: BLUE,
        }}
      />
      <Masthead dark />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 230,
          width: 940,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 156,
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: -8,
            translate: `0 ${(1 - ramp(f, 0, localBeat("finale", 62))) * 330}px`,
          }}
        >
          AIUI
          <br />
          MCPKit
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1050,
          top: 330,
          width: 790,
          fontSize: 88,
          lineHeight: 1.22,
          fontWeight: 700,
          letterSpacing: -3,
          whiteSpace: "pre-line",
          opacity: ramp(
            f,
            localBeat("finale", 62),
            localBeat("finale", 64) - localBeat("finale", 62),
          ),
        }}
      >
        {tagline}
      </div>
      <div
        style={{
          position: "absolute",
          left: 1060,
          top: 730,
          display: "flex",
          alignItems: "center",
          gap: 36,
          opacity: ramp(
            f,
            localBeat("finale", 64),
            localBeat("finale", 66) - localBeat("finale", 64),
          ),
        }}
      >
        <div
          style={{
            width: 270,
            height: 175,
            border: "2px solid #fff",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div
            style={{
              height: 16,
              width: 160,
              backgroundColor: "#fff",
              marginBottom: 20,
            }}
          />
          <div style={{ height: 48, width: 205, border: "3px solid #fff" }} />
          <div style={{ fontSize: 44, marginTop: 6 }}>In chat</div>
        </div>
        <span style={{ fontSize: 58 }}>↗</span>
        <div
          style={{
            width: 330,
            height: 225,
            border: "2px solid #fff",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div
            style={{
              height: 18,
              borderBottom: "3px solid #fff",
              marginBottom: 24,
            }}
          />
          <div style={{ fontSize: 44, marginTop: 40 }}>Full view</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 80, bottom: 95, fontSize: 36 }}>
        github.com/yodaos-project/aiui-mcpkit
      </div>
      <AbsoluteFill
        style={{
          backgroundColor: INK,
          opacity: ramp(
            f,
            localBeat("finale", 71.5),
            SHOTS.finale.duration - 1 - localBeat("finale", 71.5),
          ),
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const CrossPlatform = () => {
  const f = useCurrentFrame();
  const desktop = ramp(f, 0, localBeat("platforms", 50));
  const glasses = ramp(
    f,
    localBeat("platforms", 52),
    localBeat("platforms", 54) - localBeat("platforms", 52),
  );
  return (
    <AbsoluteFill style={root}>
      <Masthead />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 220,
          width: 690,
          fontSize: 92,
          lineHeight: 1.03,
          letterSpacing: -4,
          fontWeight: 800,
        }}
      >
        From your desk.
        <br />
        To your day.
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 540,
          fontSize: 48,
          lineHeight: 1.5,
          fontWeight: 600,
        }}
      >
        Codex · Claude Code
        <br />
        AIUI on Rokid Glasses
      </div>

      <div
        style={{
          position: "absolute",
          left: 850 + (1 - desktop) * 950,
          top: 160 - glasses * 120,
          width: 960,
          height: 500,
          opacity: 1 - glasses,
          border: "2px solid #d6d6d0",
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: "#edf3fb",
          boxShadow: "0 28px 70px #00000016",
        }}
      >
        <Img
          src={texture("inline-garden")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 820 + (1 - desktop) * 950,
          top: 675 - glasses * 120,
          width: 1020,
          height: 6,
          opacity: 1 - glasses,
          backgroundColor: "#c4c4be",
          borderRadius: 7,
        }}
      />
      <Img
        src={staticFile("brand/rokid-glasses.png")}
        style={{
          position: "absolute",
          left: 780 + (1 - glasses) * 220,
          top: 155 + (1 - glasses) * 75,
          width: 1080,
          height: 655,
          objectFit: "contain",
          opacity: glasses,
        }}
      />
    </AbsoluteFill>
  );
};
