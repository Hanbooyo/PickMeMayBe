import test from "node:test";
import assert from "node:assert/strict";

import {
  createRendererPreviewModel,
  getActiveTimelineEvent,
} from "../dist/apps/renderer/src/index.js";

const renderProps = {
  scenario: {
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
      {
        type: "candidate-roll",
        startSecond: 1.5,
        endSecond: 4.5,
      },
      {
        type: "winner-reveal",
        startSecond: 5.2,
        endSecond: 7.5,
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
      imagePath: "resources/faces/p1.png",
    },
    {
      participantId: "p2",
      imagePath: "resources/faces/p2.png",
    },
  ],
};

test("createRendererPreviewModel exposes basic render metadata", () => {
  const preview = createRendererPreviewModel(renderProps);

  assert.equal(preview.title, "PickMeMaybe LIVE");
  assert.equal(preview.totalFrames, 300);
  assert.equal(preview.fps, 30);
  assert.deepEqual(preview.winnerIds, ["p2"]);
  assert.deepEqual(
    preview.keyFrames.map((frame) => frame.activeEventType),
    ["intro", "candidate-roll", "winner-reveal"],
  );
});

test("getActiveTimelineEvent returns event type for a frame", () => {
  assert.equal(getActiveTimelineEvent(renderProps, 0), "intro");
  assert.equal(getActiveTimelineEvent(renderProps, 45), "candidate-roll");
  assert.equal(getActiveTimelineEvent(renderProps, 156), "winner-reveal");
  assert.equal(getActiveTimelineEvent(renderProps, 299), undefined);
});
