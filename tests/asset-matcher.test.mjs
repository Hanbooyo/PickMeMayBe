import test from "node:test";
import assert from "node:assert/strict";

import {
  matchVisualAssets,
  normalizeLookupKey,
} from "../dist/packages/asset-matcher/src/index.js";

const anonymousImagePath = "resources/faces/anonymous.png";

test("matchVisualAssets matches unique participant names first", () => {
  const result = matchVisualAssets(
    [
      {
        id: "p1",
        inputSource: "manual",
        name: "홍길동",
        submittedAt: "2026-05-11T00:00:00.000Z",
      },
    ],
    [{ key: "홍길동.jpg", path: "resources/faces/홍길동.jpg" }],
    { anonymousImagePath },
  );

  assert.deepEqual(result, [
    {
      participantId: "p1",
      imagePath: "resources/faces/홍길동.jpg",
      status: "matched",
      matchedBy: "name",
    },
  ]);
});

test("matchVisualAssets uses email when duplicate participant names exist", () => {
  const result = matchVisualAssets(
    [
      {
        id: "p1",
        inputSource: "excel",
        name: "김민수",
        email: "minsu.sales@example.com",
        department: "영업팀",
        submittedAt: "2026-05-11T00:00:00.000Z",
      },
      {
        id: "p2",
        inputSource: "excel",
        name: "김민수",
        email: "minsu.ops@example.com",
        department: "운영팀",
        submittedAt: "2026-05-11T00:00:00.000Z",
      },
    ],
    [
      {
        key: "minsu.sales@example.com.png",
        path: "resources/faces/minsu-sales.png",
      },
      {
        key: "minsu.ops@example.com.png",
        path: "resources/faces/minsu-ops.png",
      },
    ],
    { anonymousImagePath },
  );

  assert.deepEqual(result, [
    {
      participantId: "p1",
      imagePath: "resources/faces/minsu-sales.png",
      status: "matched",
      matchedBy: "email",
    },
    {
      participantId: "p2",
      imagePath: "resources/faces/minsu-ops.png",
      status: "matched",
      matchedBy: "email",
    },
  ]);
});

test("matchVisualAssets falls back to anonymous image", () => {
  const result = matchVisualAssets(
    [
      {
        id: "p1",
        inputSource: "manual",
        name: "이미지없음",
        submittedAt: "2026-05-11T00:00:00.000Z",
      },
    ],
    [],
    { anonymousImagePath },
  );

  assert.deepEqual(result, [
    {
      participantId: "p1",
      imagePath: anonymousImagePath,
      status: "anonymous",
      matchedBy: "fallback",
    },
  ]);
});

test("normalizeLookupKey removes file extensions and normalizes separators", () => {
  assert.equal(
    normalizeLookupKey(" MinSu.Sales@example.com.PNG "),
    "minsu-sales-example-com",
  );
});
