import test from "node:test";
import assert from "node:assert/strict";

import {
  createApiServer,
  createManualPreview,
} from "../dist/apps/api/src/index.js";

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

test("createManualPreview supports multiple winners", () => {
  const response = createManualPreview(
    {
      participants: [
        {
          name: "김민수",
          email: "minsu@example.com",
        },
        {
          name: "이서연",
          email: "seoyeon@example.com",
        },
        {
          name: "박지훈",
          email: "jihoon@example.com",
        },
      ],
      winnerCount: 2,
    },
    now,
  );

  assert.equal(response.raffleResult.winnerIds.length, 2);
  assert.equal(
    response.scenario.cards.filter((card) => card.isWinner).length,
    2,
  );
});

test("createManualPreview can exclude previous winners", () => {
  const participants = [
    {
      name: "Alpha",
      email: "alpha@example.com",
    },
    {
      name: "Beta",
      email: "beta@example.com",
    },
  ];

  const first = createManualPreview(
    {
      participants,
      winnerCount: 1,
    },
    now,
  );
  const second = createManualPreview(
    {
      participants,
      winnerCount: 1,
      allowPreviousWinners: false,
      previousWinnerIds: first.raffleResult.winnerIds,
    },
    now,
  );

  assert.equal(second.raffleResult.winnerIds.length, 1);
  assert.equal(
    first.raffleResult.winnerIds.includes(second.raffleResult.winnerIds[0]),
    false,
  );
});

test("createApiServer responds to manual preview HTTP requests", async () => {
  const server = createApiServer();
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    const port = address.port;

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const response = await fetch(`http://127.0.0.1:${port}/api/manual-preview`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        participants: [
          {
            name: "김민수",
            email: "minsu@example.com",
            department: "운영팀",
            appliedAsset: "상품 A",
          },
        ],
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(payload.participants.length, 1);
    assert.equal(payload.scenario.cards.length, 1);
  } finally {
    await close(server);
  }
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
