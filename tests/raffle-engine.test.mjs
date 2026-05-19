import test from "node:test";
import assert from "node:assert/strict";

import {
  drawWinners,
  getEligibleParticipants,
  RaffleEngineError,
} from "../dist/packages/raffle-engine/src/index.js";

const createdAt = "2026-05-11T00:00:00.000Z";

function participant(id, name = id) {
  return {
    id,
    inputSource: "manual",
    name,
    submittedAt: createdAt,
  };
}

function firstIndexRandomInt() {
  return 0;
}

test("drawWinners selects the requested number of unique winners", () => {
  const result = drawWinners({
    id: "raffle-1",
    participants: [
      participant("p1"),
      participant("p2"),
      participant("p3"),
      participant("p4"),
    ],
    options: {
      winnerCount: 2,
      allowPreviousWinners: true,
    },
    createdAt,
    randomInt: firstIndexRandomInt,
  });

  assert.equal(result.id, "raffle-1");
  assert.equal(result.winnerIds.length, 2);
  assert.equal(new Set(result.winnerIds).size, 2);
  assert.deepEqual(result.candidateIds, ["p1", "p2", "p3", "p4"]);
  assert.equal(result.proof.algorithmVersion, "pick-me-maybe-raffle@1");
  assert.equal(result.proof.randomSource, "injected");
  assert.equal(result.proof.candidateCount, 4);
  assert.equal(result.proof.winnerCount, 2);
  assert.match(result.proof.inputHash, /^[a-f0-9]{64}$/);
  assert.match(result.proof.settingsHash, /^[a-f0-9]{64}$/);
  assert.match(result.proof.resultHash, /^[a-f0-9]{64}$/);
});

test("drawWinners creates stable proof hashes for the same audited draw", () => {
  const input = {
    id: "raffle-proof",
    participants: [participant("p1"), participant("p2"), participant("p3")],
    options: {
      winnerCount: 1,
      allowPreviousWinners: true,
    },
    createdAt,
    randomSeed: "audit-seed-1",
    randomInt: firstIndexRandomInt,
  };

  const first = drawWinners(input);
  const second = drawWinners(input);

  assert.equal(first.proof.randomSeed, "audit-seed-1");
  assert.equal(first.proof.inputHash, second.proof.inputHash);
  assert.equal(first.proof.settingsHash, second.proof.settingsHash);
  assert.equal(first.proof.resultHash, second.proof.resultHash);
});

test("getEligibleParticipants excludes previous winners when configured", () => {
  const eligible = getEligibleParticipants(
    [participant("p1"), participant("p2"), participant("p3")],
    {
      winnerCount: 1,
      allowPreviousWinners: false,
    },
    ["p2"],
  );

  assert.deepEqual(
    eligible.map((item) => item.id),
    ["p1", "p3"],
  );
});

test("drawWinners throws when winner count exceeds eligible count", () => {
  assert.throws(
    () =>
      drawWinners({
        id: "raffle-1",
        participants: [participant("p1")],
        options: {
          winnerCount: 2,
          allowPreviousWinners: true,
        },
        createdAt,
        randomInt: firstIndexRandomInt,
      }),
    (error) =>
      error instanceof RaffleEngineError &&
      error.code === "WINNER_COUNT_EXCEEDS_ELIGIBLE_COUNT",
  );
});

test("drawWinners throws on invalid winner count", () => {
  assert.throws(
    () =>
      drawWinners({
        id: "raffle-1",
        participants: [participant("p1")],
        options: {
          winnerCount: 0,
          allowPreviousWinners: true,
        },
        createdAt,
      }),
    (error) =>
      error instanceof RaffleEngineError &&
      error.code === "INVALID_WINNER_COUNT",
  );
});

test("drawWinners throws on duplicate participant ids", () => {
  assert.throws(
    () =>
      drawWinners({
        id: "raffle-1",
        participants: [participant("p1"), participant("p1")],
        options: {
          winnerCount: 1,
          allowPreviousWinners: true,
        },
        createdAt,
      }),
    (error) =>
      error instanceof RaffleEngineError &&
      error.code === "DUPLICATE_PARTICIPANT_ID",
  );
});
