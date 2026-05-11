import test from "node:test";
import assert from "node:assert/strict";

import {
  createElectionBroadcastRenderProps,
  createLandscapeRenderSettings,
} from "../dist/packages/render-types/src/index.js";

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
      imagePath: "resources/faces/p1.png",
      isWinner: false,
    },
    {
      participantId: "p2",
      name: "이서연",
      imagePath: "resources/faces/p2.png",
      isWinner: true,
    },
  ],
  timeline: [
    {
      type: "intro",
      startSecond: 0,
      endSecond: 1.5,
    },
  ],
};

test("createLandscapeRenderSettings creates 16:9 1080p settings", () => {
  assert.deepEqual(createLandscapeRenderSettings(10, 30), {
    aspectRatio: "16:9",
    resolution: {
      width: 1920,
      height: 1080,
    },
    fps: 30,
    durationSeconds: 10,
    totalFrames: 300,
  });
});

test("createElectionBroadcastRenderProps maps scenario cards to assets", () => {
  const props = createElectionBroadcastRenderProps(scenario, 24);

  assert.equal(props.video.fps, 24);
  assert.equal(props.video.totalFrames, 240);
  assert.deepEqual(props.assets, [
    {
      participantId: "p1",
      imagePath: "resources/faces/p1.png",
    },
    {
      participantId: "p2",
      imagePath: "resources/faces/p2.png",
    },
  ]);
});

test("createLandscapeRenderSettings rejects invalid fps", () => {
  assert.throws(
    () => createLandscapeRenderSettings(10, 0),
    /fps must be a positive integer/,
  );
});
