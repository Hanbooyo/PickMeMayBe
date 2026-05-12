import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import type { ElectionBroadcastRenderProps } from "../../../../packages/render-types/src/index.js";

export function ElectionBroadcastComposition({
  scenario,
}: ElectionBroadcastRenderProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const revealStart = scenario.timeline.find(
    (event) => event.type === "winner-reveal",
  )?.startSecond ?? 5.2;
  const revealProgress = interpolate(
    frame,
    [revealStart * fps, (revealStart + 1.2) * fps],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const winnerCards = scenario.cards.filter((card) => card.isWinner);
  const race = scenario.presentationMode === "running-race" ? scenario.race : undefined;
  const isRaceMode = Boolean(race);

  return (
    <AbsoluteFill style={styles.root}>
      <div style={styles.header}>
        <div style={styles.title}>{scenario.title}</div>
        <div style={styles.live}>{isRaceMode ? "RUNNING RACE" : "LIVE RAFFLE"}</div>
      </div>
      <div style={styles.content}>
        {isRaceMode ? (
          <div style={styles.raceTrack}>
            {race?.lanes.map((lane) => {
              const card = scenario.cards.find(
                (candidate) => candidate.participantId === lane.participantId,
              );
              const laneProgress = interpolate(
                frame,
                [
                  0,
                  race.suspenseSecond * fps,
                  race.revealSecond * fps,
                ],
                [lane.startPercent, lane.midpointPercent, lane.finishPercent],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              );

              if (!card) {
                return null;
              }

              return (
                <div key={lane.participantId} style={styles.raceLane}>
                  <div style={styles.laneLabel}>{lane.lane}</div>
                  <div style={styles.laneRail}>
                    <div
                      style={{
                        ...styles.runner,
                        left: `${laneProgress}%`,
                        ...(lane.isWinner ? styles.winnerRunner : {}),
                      }}
                    >
                      <Img src={resolveImageSource(card.imagePath)} style={styles.runnerAvatar} />
                      <span style={styles.runnerName}>{card.name}</span>
                    </div>
                  </div>
                  <div style={styles.rankLabel}>#{lane.finishRank}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.ranking}>
            {scenario.cards.map((card, index) => (
              <div
                key={card.participantId}
                style={{
                  ...styles.candidate,
                  ...(card.isWinner ? styles.winnerCandidate : {}),
                }}
              >
                <Img src={resolveImageSource(card.imagePath)} style={styles.avatar} />
                <div style={styles.candidateText}>
                  <div style={styles.name}>{card.name}</div>
                  <div style={styles.meta}>
                    {[card.department, card.appliedAsset].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div style={styles.bar}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${card.isWinner ? 92 : 58 - index * 8}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={styles.winnerPanel}>
          <div style={styles.winnerLabel}>최종 당첨 확정</div>
          <div
            style={{
              ...styles.winnerName,
              opacity: revealProgress,
              transform: `scale(${0.88 + revealProgress * 0.12})`,
            }}
          >
            {winnerCards.map((card) => card.name).join(", ")}
          </div>
        </div>
      </div>
      <div style={styles.footer}>
        속보: {isRaceMode ? "달리기형 추첨 레이스" : "PickMeMaybe 추첨"} 집계 완료
      </div>
    </AbsoluteFill>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    background:
      "linear-gradient(135deg, rgba(15,23,42,1), rgba(30,41,59,1))",
    color: "#e5e7eb",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    height: 112,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 56px",
    borderBottom: "1px solid rgba(148,163,184,0.26)",
  },
  title: {
    fontSize: 46,
    fontWeight: 900,
  },
  live: {
    color: "#fecaca",
    border: "2px solid rgba(248,113,113,0.65)",
    borderRadius: 8,
    padding: "12px 18px",
    fontSize: 22,
    fontWeight: 900,
  },
  content: {
    display: "grid",
    gridTemplateColumns: "1.16fr 0.84fr",
    gap: 42,
    padding: 54,
    flex: 1,
  },
  ranking: {
    display: "grid",
    gap: 20,
    alignContent: "start",
  },
  raceTrack: {
    display: "grid",
    gap: 22,
    alignContent: "center",
    padding: "10px 0",
  },
  raceLane: {
    display: "grid",
    gridTemplateColumns: "54px 1fr 72px",
    alignItems: "center",
    gap: 18,
  },
  laneLabel: {
    height: 54,
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    background: "rgba(185,28,28,0.82)",
    color: "#fee2e2",
    fontSize: 24,
    fontWeight: 900,
  },
  laneRail: {
    position: "relative",
    height: 82,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.28)",
    background:
      "linear-gradient(90deg, rgba(30,41,59,0.88), rgba(15,23,42,0.72))",
    overflow: "hidden",
  },
  runner: {
    position: "absolute",
    top: "50%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 156,
    transform: "translate(-50%, -50%)",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.75)",
    background: "rgba(2,6,23,0.88)",
    boxShadow: "0 10px 24px rgba(2,6,23,0.35)",
  },
  winnerRunner: {
    borderColor: "rgba(250,204,21,1)",
    boxShadow: "0 0 28px rgba(250,204,21,0.45)",
  },
  runnerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    objectFit: "cover",
  },
  runnerName: {
    fontSize: 20,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  rankLabel: {
    color: "#fde68a",
    fontSize: 24,
    fontWeight: 900,
    textAlign: "center",
  },
  candidate: {
    display: "grid",
    gridTemplateColumns: "112px 1fr 180px",
    alignItems: "center",
    gap: 24,
    padding: 18,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(15,23,42,0.72)",
  },
  winnerCandidate: {
    borderColor: "rgba(250,204,21,0.96)",
    background:
      "linear-gradient(90deg, rgba(113,63,18,0.72), rgba(15,23,42,0.82))",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 12,
    objectFit: "cover",
  },
  candidateText: {
    display: "grid",
    gap: 7,
  },
  name: {
    fontSize: 32,
    fontWeight: 900,
  },
  meta: {
    color: "#cbd5e1",
    fontSize: 20,
  },
  bar: {
    height: 18,
    borderRadius: 999,
    background: "rgba(148,163,184,0.25)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    background: "linear-gradient(90deg, #38bdf8, #facc15)",
  },
  winnerPanel: {
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    textAlign: "center",
    borderLeft: "1px solid rgba(148,163,184,0.2)",
    paddingLeft: 44,
  },
  winnerLabel: {
    color: "#fde68a",
    fontSize: 34,
    fontWeight: 900,
  },
  winnerName: {
    marginTop: 18,
    fontSize: 84,
    fontWeight: 900,
    lineHeight: 1.08,
  },
  footer: {
    height: 72,
    display: "flex",
    alignItems: "center",
    padding: "0 56px",
    background: "rgba(185,28,28,0.95)",
    fontSize: 24,
    fontWeight: 900,
  },
};

function resolveImageSource(imagePath: string): string {
  if (imagePath.startsWith("data:") || imagePath.startsWith("http")) {
    return imagePath;
  }

  return staticFile(imagePath);
}
