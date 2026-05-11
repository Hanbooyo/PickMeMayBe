import type { ElectionBroadcastRenderProps } from "../../../packages/render-types/src/index.js";

export function createElectionBroadcastSampleProps(): ElectionBroadcastRenderProps {
  return {
    scenario: {
      id: "sample-scenario",
      mode: "election-broadcast",
      raffleResultId: "sample-raffle",
      participantIds: ["p1", "p2", "p3"],
      winnerIds: ["p2"],
      durationSeconds: 10,
      title: "PickMeMaybe LIVE",
      aspectRatio: "16:9",
      cards: [
        {
          participantId: "p1",
          name: "김민수",
          department: "운영팀",
          appliedAsset: "상품 A",
          imagePath: "resources/faces/김민수.svg",
          isWinner: false,
        },
        {
          participantId: "p2",
          name: "이서연",
          department: "마케팅팀",
          appliedAsset: "상품 B",
          imagePath: "resources/faces/이서연.svg",
          isWinner: true,
        },
        {
          participantId: "p3",
          name: "박지훈",
          department: "개발팀",
          appliedAsset: "상품 C",
          imagePath: "resources/faces/박지훈.svg",
          isWinner: false,
        },
      ],
      timeline: [
        {
          type: "intro",
          startSecond: 0,
          endSecond: 1.5,
        },
        {
          type: "candidate-roll",
          startSecond: 1.5,
          endSecond: 4.5,
        },
        {
          type: "suspense-pause",
          startSecond: 4.5,
          endSecond: 5.2,
        },
        {
          type: "winner-reveal",
          startSecond: 5.2,
          endSecond: 7.5,
        },
        {
          type: "celebration",
          startSecond: 7.5,
          endSecond: 10,
        },
      ],
    },
    video: {
      aspectRatio: "16:9",
      resolution: {
        width: 1920,
        height: 1080,
      },
      fps: 30,
      durationSeconds: 10,
      totalFrames: 300,
    },
    assets: [
      {
        participantId: "p1",
        imagePath: "resources/faces/김민수.svg",
      },
      {
        participantId: "p2",
        imagePath: "resources/faces/이서연.svg",
      },
      {
        participantId: "p3",
        imagePath: "resources/faces/박지훈.svg",
      },
    ],
  };
}
