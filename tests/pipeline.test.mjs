import test from "node:test";
import assert from "node:assert/strict";

import { matchVisualAssets } from "../dist/packages/asset-matcher/src/index.js";
import { createElectionBroadcastScenario } from "../dist/packages/presentation-engine/src/index.js";
import { drawWinners } from "../dist/packages/raffle-engine/src/index.js";
import {
  normalizeManualInputs,
  normalizeRosterRows,
} from "../dist/packages/roster-import/src/index.js";

const importedAt = "2026-05-11T00:00:00.000Z";

function firstIndexRandomInt() {
  return 0;
}

test("pipeline converts roster rows into a broadcast winner scenario", () => {
  const normalized = normalizeRosterRows(
    [
      {
        name: "김민수",
        email: "minsu@example.com",
        department: "운영팀",
        appliedAsset: "상품 A",
        submittedAt: importedAt,
      },
      {
        name: "이서연",
        email: "seoyeon@example.com",
        department: "마케팅팀",
        appliedAsset: "상품 B",
        submittedAt: importedAt,
      },
      {
        name: "박지훈",
        email: "jihoon@example.com",
        department: "개발팀",
        appliedAsset: "상품 C",
        submittedAt: importedAt,
      },
    ],
    { importedAt },
  );

  assert.deepEqual(normalized.errors, []);

  const visualAssets = matchVisualAssets(
    normalized.participants,
    [
      {
        key: "김민수.png",
        path: "resources/faces/김민수.png",
      },
      {
        key: "이서연.png",
        path: "resources/faces/이서연.png",
      },
      {
        key: "박지훈.png",
        path: "resources/faces/박지훈.png",
      },
    ],
    {
      anonymousImagePath: "resources/faces/anonymous.png",
    },
  );

  assert.equal(visualAssets.every((asset) => asset.status === "matched"), true);

  const raffleResult = drawWinners({
    id: "raffle-1",
    participants: normalized.participants,
    options: {
      winnerCount: 1,
      allowPreviousWinners: true,
    },
    createdAt: importedAt,
    randomInt: firstIndexRandomInt,
  });

  const scenario = createElectionBroadcastScenario({
    id: "scenario-1",
    title: "PickMeMaybe LIVE",
    raffleResult,
    participants: normalized.participants,
    visualAssets,
    durationSeconds: 10,
  });

  assert.equal(scenario.mode, "election-broadcast");
  assert.equal(scenario.cards.length, 3);
  assert.equal(scenario.winnerIds.length, 1);
  assert.equal(
    scenario.cards.filter((card) => card.isWinner).length,
    1,
  );
  assert.deepEqual(scenario.participantIds, raffleResult.candidateIds);
});

test("pipeline converts manual inputs into a broadcast winner scenario", () => {
  const normalized = normalizeManualInputs(
    [
      {
        name: "김민수",
        email: "minsu@example.com",
        department: "운영팀",
        appliedAsset: "상품 A",
      },
      {
        name: "이서연",
        email: "seoyeon@example.com",
        department: "마케팅팀",
        appliedAsset: "상품 B",
      },
    ],
    { importedAt },
  );

  assert.deepEqual(normalized.errors, []);
  assert.equal(
    normalized.participants.every(
      (participant) => participant.inputSource === "manual",
    ),
    true,
  );

  const visualAssets = matchVisualAssets(
    normalized.participants,
    [
      {
        key: "김민수.png",
        path: "resources/faces/김민수.png",
      },
      {
        key: "이서연.png",
        path: "resources/faces/이서연.png",
      },
    ],
    {
      anonymousImagePath: "resources/faces/anonymous.png",
    },
  );

  const raffleResult = drawWinners({
    id: "raffle-manual-1",
    participants: normalized.participants,
    options: {
      winnerCount: 1,
      allowPreviousWinners: true,
    },
    createdAt: importedAt,
    randomInt: firstIndexRandomInt,
  });

  const scenario = createElectionBroadcastScenario({
    id: "scenario-manual-1",
    title: "PickMeMaybe LIVE",
    raffleResult,
    participants: normalized.participants,
    visualAssets,
    durationSeconds: 10,
  });

  assert.equal(scenario.cards.length, 2);
  assert.equal(scenario.cards.filter((card) => card.isWinner).length, 1);
});
