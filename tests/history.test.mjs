import test from "node:test";
import assert from "node:assert/strict";

import {
  addHistoryEntry,
  createHistoryEntryFromScenario,
} from "../dist/packages/history/src/index.js";

const scenario = {
  id: "scenario-1",
  mode: "election-broadcast",
  raffleResultId: "raffle-1",
  participantIds: ["p1", "p2"],
  winnerIds: ["p2"],
  durationSeconds: 10,
  title: "PickMeMaybe LIVE",
  aspectRatio: "16:9",
  cards: [
    {
      participantId: "p1",
      name: "김민수",
      imagePath: "resources/faces/김민수.svg",
      isWinner: false,
    },
    {
      participantId: "p2",
      name: "이서연",
      imagePath: "resources/faces/이서연.svg",
      isWinner: true,
    },
  ],
  timeline: [],
};

test("createHistoryEntryFromScenario extracts winner names", () => {
  assert.deepEqual(
    createHistoryEntryFromScenario(scenario, "2026-05-11T00:00:00.000Z"),
    {
      id: "scenario-1",
      title: "PickMeMaybe LIVE",
      createdAt: "2026-05-11T00:00:00.000Z",
      winnerIds: ["p2"],
      winnerNames: ["이서연"],
    },
  );
});

test("addHistoryEntry prepends entries and applies limit", () => {
  const first = createHistoryEntryFromScenario(
    { ...scenario, id: "scenario-1" },
    "2026-05-11T00:00:00.000Z",
  );
  const second = createHistoryEntryFromScenario(
    { ...scenario, id: "scenario-2" },
    "2026-05-11T00:00:01.000Z",
  );

  assert.deepEqual(addHistoryEntry([first], second, 1), [second]);
});

test("addHistoryEntry rejects invalid limits", () => {
  assert.throws(
    () =>
      addHistoryEntry(
        [],
        createHistoryEntryFromScenario(scenario, "2026-05-11T00:00:00.000Z"),
        0,
      ),
    /positive integer/,
  );
});
