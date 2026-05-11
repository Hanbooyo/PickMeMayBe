import test from "node:test";
import assert from "node:assert/strict";

import { createManualPreview } from "../dist/apps/api/src/index.js";

const now = "2026-05-11T00:00:00.000Z";

test("createManualPreview returns a complete preview response", () => {
  const response = createManualPreview(
    {
      participants: [
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
      resources: [
        {
          key: "김민수.png",
          path: "resources/faces/김민수.png",
        },
        {
          key: "이서연.png",
          path: "resources/faces/이서연.png",
        },
      ],
      title: "PickMeMaybe API Preview",
    },
    now,
  );

  assert.equal(response.participants.length, 2);
  assert.equal(response.visualAssets.length, 2);
  assert.equal(response.raffleResult.winnerIds.length, 1);
  assert.equal(response.scenario.title, "PickMeMaybe API Preview");
  assert.equal(response.preview.totalFrames, 300);
});

test("createManualPreview rejects invalid manual input", () => {
  assert.throws(
    () =>
      createManualPreview(
        {
          participants: [{ name: "" }],
        },
        now,
      ),
    /Participant name is required/,
  );
});
