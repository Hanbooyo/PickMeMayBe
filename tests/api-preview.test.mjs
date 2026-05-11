import test from "node:test";
import assert from "node:assert/strict";

import {
  clearPreviewHistory,
  createApiServer,
  createManualPreview,
  getPreviewHistory,
  parseRosterFile,
} from "../dist/apps/api/src/index.js";
import * as XLSX from "xlsx";

const now = "2026-05-11T00:00:00.000Z";

test("createManualPreview returns a complete preview response", () => {
  clearPreviewHistory();
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
  assert.equal(response.history.length, 1);
  assert.equal(getPreviewHistory().length, 1);
});

test("createManualPreview rejects invalid manual input", () => {
  clearPreviewHistory();
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
  clearPreviewHistory();
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
  clearPreviewHistory();
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
  clearPreviewHistory();
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
    assert.equal(payload.history.length, 1);

    const historyResponse = await fetch(`http://127.0.0.1:${port}/api/history`);
    const historyPayload = await historyResponse.json();
    assert.equal(historyResponse.status, 200);
    assert.equal(historyPayload.history.length, 1);
  } finally {
    await close(server);
  }
});

test("createApiServer returns structured raffle errors", async () => {
  clearPreviewHistory();
  const server = createApiServer();
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/manual-preview`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        participants: [
          {
            name: "김민수",
            email: "minsu@example.com",
          },
        ],
        winnerCount: 2,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, "WINNER_COUNT_EXCEEDS_ELIGIBLE_COUNT");
  } finally {
    await close(server);
  }
});

test("parseRosterFile parses xlsx workbook data", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["이름", "이메일", "부서", "응모자산"],
    ["김민수", "minsu@example.com", "운영팀", "상품 A"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Participants");
  const fileBase64 = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "base64",
  });

  assert.deepEqual(parseRosterFile(fileBase64), [
    {
      name: "김민수",
      email: "minsu@example.com",
      department: "운영팀",
      appliedAsset: "상품 A",
    },
  ]);
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
