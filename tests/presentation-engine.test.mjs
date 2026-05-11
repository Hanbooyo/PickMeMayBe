import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultBroadcastTimeline,
  createElectionBroadcastScenario,
} from "../dist/packages/presentation-engine/src/index.js";

const createdAt = "2026-05-11T00:00:00.000Z";

const participants = [
  {
    id: "p1",
    inputSource: "manual",
    name: "김민수",
    department: "운영팀",
    appliedAsset: "상품 A",
    submittedAt: createdAt,
  },
  {
    id: "p2",
    inputSource: "manual",
    name: "이서연",
    department: "마케팅팀",
    appliedAsset: "상품 B",
    submittedAt: createdAt,
  },
];

const visualAssets = [
  {
    participantId: "p1",
    imagePath: "resources/faces/p1.png",
    status: "matched",
    matchedBy: "name",
  },
  {
    participantId: "p2",
    imagePath: "resources/faces/p2.png",
    status: "matched",
    matchedBy: "name",
  },
];

const raffleResult = {
  id: "raffle-1",
  winnerIds: ["p2"],
  candidateIds: ["p1", "p2"],
  options: {
    winnerCount: 1,
    allowPreviousWinners: true,
  },
  createdAt,
};

test("createElectionBroadcastScenario creates winner cards and timeline", () => {
  const scenario = createElectionBroadcastScenario({
    id: "scenario-1",
    title: "PickMeMaybe LIVE",
    raffleResult,
    participants,
    visualAssets,
    durationSeconds: 10,
  });

  assert.equal(scenario.id, "scenario-1");
  assert.equal(scenario.mode, "election-broadcast");
  assert.equal(scenario.aspectRatio, "16:9");
  assert.deepEqual(scenario.participantIds, ["p1", "p2"]);
  assert.deepEqual(scenario.winnerIds, ["p2"]);
  assert.equal(scenario.cards.length, 2);
  assert.equal(scenario.cards[0].isWinner, false);
  assert.equal(scenario.cards[1].isWinner, true);
  assert.equal(scenario.cards[1].imagePath, "resources/faces/p2.png");
  assert.deepEqual(
    scenario.timeline.map((event) => event.type),
    [
      "intro",
      "candidate-roll",
      "suspense-pause",
      "winner-reveal",
      "celebration",
    ],
  );
});

test("createElectionBroadcastScenario throws when a visual asset is missing", () => {
  assert.throws(
    () =>
      createElectionBroadcastScenario({
        id: "scenario-1",
        title: "PickMeMaybe LIVE",
        raffleResult,
        participants,
        visualAssets: visualAssets.slice(0, 1),
      }),
    /Missing visual asset/,
  );
});

test("createElectionBroadcastScenario throws when winners are not candidates", () => {
  assert.throws(
    () =>
      createElectionBroadcastScenario({
        id: "scenario-1",
        title: "PickMeMaybe LIVE",
        raffleResult: {
          ...raffleResult,
          winnerIds: ["missing-winner"],
        },
        participants,
        visualAssets,
      }),
    /Winner is not included in candidates/,
  );
});

test("createElectionBroadcastScenario throws on duplicate winners", () => {
  assert.throws(
    () =>
      createElectionBroadcastScenario({
        id: "scenario-1",
        title: "PickMeMaybe LIVE",
        raffleResult: {
          ...raffleResult,
          winnerIds: ["p2", "p2"],
        },
        participants,
        visualAssets,
      }),
    /Duplicate winner/,
  );
});

test("createDefaultBroadcastTimeline rejects too short duration", () => {
  assert.throws(
    () => createDefaultBroadcastTimeline(5),
    /at least 6 seconds/,
  );
});
