import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  clearPreviewHistory,
  createApiServer,
  createManualPreview,
  getPreviewHistory,
  listRenderArtifacts,
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

    const rendersResponse = await fetch(`http://127.0.0.1:${port}/api/renders`);
    const rendersPayload = await rendersResponse.json();
    assert.equal(rendersResponse.status, 200);
    assert.equal(Array.isArray(rendersPayload.renders), true);
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

test("createApiServer downloads validated render artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-renders-"));
  const artifact = createMp4Fixture();
  await writeFile(join(directory, "broadcast.mp4"), artifact);

  const server = createApiServer({
    renderDirectory: directory,
  });
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/renders/broadcast.mp4`,
    );
    const body = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "video/mp4");
    assert.equal(response.headers.get("content-length"), String(artifact.length));
    assert.deepEqual(body, artifact);
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});

test("createApiServer triggers a sample render runner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-renders-"));
  const server = createApiServer({
    renderDirectory: directory,
    renderSample: async () => {
      await writeFile(join(directory, "triggered.mp4"), createMp4Fixture());

      return {
        stdout: "rendered",
        stderr: "",
      };
    },
  });
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/render-sample`, {
      method: "POST",
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.render.stdout, "rendered");
    assert.equal(payload.renders.length, 1);
    assert.equal(payload.renders[0].fileName, "triggered.mp4");
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});

test("createApiServer rejects unsafe render artifact paths", async () => {
  const server = createApiServer();
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/renders/..%2Fsecret.mp4`,
    );
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.error, "Render artifact not found.");
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

test("listRenderArtifacts returns validated mp4 render summaries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-renders-"));

  try {
    await writeFile(join(directory, "ignored.txt"), "not a render");
    await writeFile(join(directory, "broadcast.mp4"), createMp4Fixture());

    assert.deepEqual(await listRenderArtifacts(directory), [
      {
        fileName: "broadcast.mp4",
        path: join(directory, "broadcast.mp4"),
        sizeBytes: 2060,
        format: "mp4",
      },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
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

function createMp4Fixture() {
  return Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypmp42"),
    Buffer.alloc(2048),
  ]);
}
