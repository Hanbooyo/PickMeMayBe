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
  const density = createLayoutDensity(scenario.cards.length);

  return (
    <AbsoluteFill style={styles.root}>
      <div style={styles.header}>
        <div style={styles.title}>{scenario.title}</div>
        <div style={styles.live}>{isRaceMode ? "RUNNING RACE" : "LIVE RAFFLE"}</div>
      </div>
      <div style={styles.content}>
        {isRaceMode ? (
          <div style={{ ...styles.raceTrack, gap: density.raceGap }}>
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
                  <div style={{ ...styles.laneLabel, height: density.laneHeight }}>
                    {lane.lane}
                  </div>
                  <div style={{ ...styles.laneRail, height: density.laneHeight }}>
                    <div
                      style={{
                        ...styles.runner,
                        minWidth: density.runnerMinWidth,
                        left: `${laneProgress}%`,
                        ...(lane.isWinner ? styles.winnerRunner : {}),
                      }}
                    >
                      <Img
                        src={resolveImageSource(card.imagePath)}
                        style={{
                          ...styles.runnerAvatar,
                          width: density.runnerAvatarSize,
                          height: density.runnerAvatarSize,
                        }}
                      />
                      <span style={{ ...styles.runnerName, fontSize: density.runnerFontSize }}>
                        {card.name}
                      </span>
                    </div>
                  </div>
                  <div style={{ ...styles.rankLabel, fontSize: density.rankFontSize }}>
                    #{lane.finishRank}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ ...styles.ranking, gap: density.candidateGap }}>
            {scenario.cards.map((card, index) => (
              <div
                key={card.participantId}
                style={{
                  ...styles.candidate,
                  gridTemplateColumns: `${density.avatarSize + 16}px 1fr 150px`,
                  gap: density.candidateGap,
                  padding: density.candidatePadding,
                  ...(card.isWinner ? styles.winnerCandidate : {}),
                }}
              >
                <Img
                  src={resolveImageSource(card.imagePath)}
                  style={{
                    ...styles.avatar,
                    width: density.avatarSize,
                    height: density.avatarSize,
                  }}
                />
                <div style={styles.candidateText}>
                  <div style={{ ...styles.name, fontSize: density.nameFontSize }}>
                    {card.name}
                  </div>
                  <div style={{ ...styles.meta, fontSize: density.metaFontSize }}>
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
              fontSize: density.winnerFontSize,
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
    minHeight: 0,
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
    overflow: "hidden",
    textOverflow: "ellipsis",
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
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  meta: {
    color: "#cbd5e1",
    fontSize: 20,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
    maxWidth: "100%",
    overflowWrap: "anywhere",
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

function createLayoutDensity(cardCount: number) {
  if (cardCount >= 9) {
    return {
      avatarSize: 54,
      candidateGap: 10,
      candidatePadding: 10,
      nameFontSize: 21,
      metaFontSize: 14,
      winnerFontSize: 52,
      raceGap: 10,
      laneHeight: 54,
      runnerAvatarSize: 28,
      runnerFontSize: 15,
      runnerMinWidth: 112,
      rankFontSize: 18,
    };
  }

  if (cardCount >= 6) {
    return {
      avatarSize: 68,
      candidateGap: 14,
      candidatePadding: 12,
      nameFontSize: 25,
      metaFontSize: 16,
      winnerFontSize: 64,
      raceGap: 14,
      laneHeight: 64,
      runnerAvatarSize: 34,
      runnerFontSize: 17,
      runnerMinWidth: 132,
      rankFontSize: 21,
    };
  }

  return {
    avatarSize: 96,
    candidateGap: 20,
    candidatePadding: 18,
    nameFontSize: 32,
    metaFontSize: 20,
    winnerFontSize: 84,
    raceGap: 22,
    laneHeight: 82,
    runnerAvatarSize: 42,
    runnerFontSize: 20,
    runnerMinWidth: 156,
    rankFontSize: 24,
  };
}

function resolveImageSource(imagePath: string): string {
  if (imagePath.startsWith("data:") || imagePath.startsWith("http")) {
    return imagePath;
  }

  return staticFile(imagePath);
}
