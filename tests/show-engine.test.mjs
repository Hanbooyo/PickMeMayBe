import test from "node:test";
import assert from "node:assert/strict";

import { createElectionBroadcastScenario } from "../dist/packages/presentation-engine/src/index.js";
import {
  createDefaultShowSteps,
  createShowPlan,
} from "../dist/packages/show-engine/src/index.js";

const createdAt = "2026-05-11T00:00:00.000Z";

const participants = [
  {
    id: "p1",
    inputSource: "manual",
    name: "A",
    submittedAt: createdAt,
  },
  {
    id: "p2",
    inputSource: "manual",
    name: "B",
    submittedAt: createdAt,
  },
  {
    id: "p3",
    inputSource: "manual",
    name: "C",
    submittedAt: createdAt,
  },
];

const visualAssets = participants.map((participant) => ({
  participantId: participant.id,
  imagePath: `resources/faces/${participant.id}.png`,
  status: "matched",
  matchedBy: "name",
}));

const raffleResult = {
  id: "raffle-race",
  winnerIds: ["p2"],
  candidateIds: ["p1", "p2", "p3"],
  options: {
    winnerCount: 1,
    allowPreviousWinners: true,
  },
  createdAt,
};

test("createDefaultShowSteps creates a full process timeline", () => {
  const steps = createDefaultShowSteps(10000);

  assert.deepEqual(
    steps.map((step) => step.phase),
    ["ready", "start", "shuffle", "chase", "slowdown", "finish", "reveal"],
  );
  assert.equal(steps[0].startMs, 0);
  assert.equal(steps.at(-1).endMs, 10000);
});

test("createShowPlan maps a running race scenario to lanes and keyframes", () => {
  const scenario = createElectionBroadcastScenario({
    id: "scenario-race",
    title: "PickMeMaybe Race",
    raffleResult,
    participants,
    visualAssets,
    presentationMode: "running-race",
    durationSeconds: 10,
  });

  const plan = createShowPlan(scenario, {
    durationMs: 10000,
    seed: "race-reference",
  });

  assert.equal(plan.mode, "running-race");
  assert.equal(plan.durationMs, 10000);
  assert.equal(plan.lanes.length, 3);
  assert.equal(plan.lanes[1].participantId, "p2");
  assert.equal(plan.lanes[1].isWinner, true);
  assert.equal(plan.lanes[1].keyframes.at(-1).positionPercent, 100);
  assert.ok(plan.lanes[0].keyframes.at(-1).positionPercent < 100);
});

test("createShowPlan keeps generic modes as timeline-only plans", () => {
  const scenario = createElectionBroadcastScenario({
    id: "scenario-vote",
    title: "PickMeMaybe Vote",
    raffleResult,
    participants,
    visualAssets,
    presentationMode: "vote-count",
    durationSeconds: 10,
  });

  const plan = createShowPlan(scenario);

  assert.equal(plan.mode, "vote-count");
  assert.equal(plan.durationMs, 10000);
  assert.equal(plan.steps.length, 7);
  assert.equal("lanes" in plan, false);
});

test("createShowPlan creates a rolling picker plan that locks on a winner", () => {
  const scenario = createElectionBroadcastScenario({
    id: "scenario-rolling",
    title: "PickMeMaybe Rolling",
    raffleResult,
    participants,
    visualAssets,
    presentationMode: "rolling-picker",
    durationSeconds: 10,
  });

  const plan = createShowPlan(scenario, {
    seed: "rolling-reference",
  });

  assert.equal(plan.mode, "rolling-picker");
  assert.ok(plan.items.length >= 24);
  assert.equal(plan.lockIndex, plan.items.length - 1);
  assert.equal(plan.items[plan.lockIndex].participantId, "p2");
  assert.equal(plan.items[plan.lockIndex].isWinner, true);
});

test("createShowPlan creates three-turn dice rolls with winners ranked first", () => {
  const scenario = createElectionBroadcastScenario({
    id: "scenario-dice",
    title: "PickMeMaybe Dice",
    raffleResult,
    participants,
    visualAssets,
    presentationMode: "dice-roll",
    durationSeconds: 10,
  });

  const plan = createShowPlan(scenario, {
    seed: "dice-reference",
  });

  assert.equal(plan.mode, "dice-roll");
  assert.equal(plan.turnCount, 3);
  assert.equal(plan.rolls.length, 3);
  assert.ok(plan.rolls.every((roll) => roll.turns.length === 3));
  assert.equal(plan.rolls[0].participantId, "p2");
  assert.equal(plan.rolls[0].isWinner, true);
  assert.ok(plan.rolls[0].total >= plan.rolls.at(-1).total);
});

test("createDefaultShowSteps rejects too-short timelines", () => {
  assert.throws(() => createDefaultShowSteps(5000), /at least 6000ms/);
});
