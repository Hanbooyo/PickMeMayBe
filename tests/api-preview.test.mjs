import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  clearPreviewHistory,
  clearRenderJobs,
  createApiServer,
  createManualPreview,
  getPreviewHistory,
  listFaceResources,
  listRenderJobs,
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

    const resourcesResponse = await fetch(`http://127.0.0.1:${port}/api/resources/faces`);
    const resourcesPayload = await resourcesResponse.json();
    assert.equal(resourcesResponse.status, 200);
    assert.equal(Array.isArray(resourcesPayload.resources), true);
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

test("createApiServer renders the latest manual preview", async () => {
  clearPreviewHistory();
  createManualPreview(
    {
      participants: [
        {
          name: "Alpha",
          email: "alpha@example.com",
        },
      ],
    },
    now,
  );

  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-renders-"));
  const inputDirectory = await mkdtemp(join(tmpdir(), "pick-me-maybe-render-inputs-"));
  const server = createApiServer({
    renderDirectory: directory,
    renderInputDirectory: inputDirectory,
    renderLatest: async (outputPath, inputPropsPath) => {
      const inputProps = JSON.parse(await readFile(inputPropsPath, "utf8"));
      assert.equal(inputProps.scenario.cards[0].name, "Alpha");
      await writeFile(outputPath, createMp4Fixture());

      return {
        stdout: `rendered ${outputPath}`,
        stderr: "",
      };
    },
  });
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/render-latest`, {
      method: "POST",
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.match(payload.render.stdout, /rendered/);
    assert.equal(payload.renders.length, 1);
    assert.match(payload.renders[0].fileName, /^election-broadcast-/);
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
    await rm(inputDirectory, { recursive: true, force: true });
    clearPreviewHistory();
  }
});

test("createApiServer enqueues and completes latest render jobs", async () => {
  clearPreviewHistory();
  clearRenderJobs();
  createManualPreview(
    {
      participants: [
        {
          name: "Alpha",
          email: "alpha@example.com",
        },
      ],
    },
    now,
  );

  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-renders-"));
  const inputDirectory = await mkdtemp(join(tmpdir(), "pick-me-maybe-render-inputs-"));
  const server = createApiServer({
    renderDirectory: directory,
    renderInputDirectory: inputDirectory,
    renderLatest: async (outputPath) => {
      await writeFile(outputPath, createMp4Fixture());

      return {
        stdout: "job rendered",
        stderr: "",
      };
    },
  });
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");

    const createResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/render-latest-jobs`,
      {
        method: "POST",
      },
    );
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 202);
    assert.equal(createPayload.job.status, "queued");

    const completed = await waitForRenderJob(address.port, createPayload.job.id);
    assert.equal(completed.status, "done");
    assert.equal(completed.result.stdout, "job rendered");
    assert.equal(completed.renders.length, 1);

    const jobsResponse = await fetch(`http://127.0.0.1:${address.port}/api/render-jobs`);
    const jobsPayload = await jobsResponse.json();
    assert.equal(jobsResponse.status, 200);
    assert.equal(jobsPayload.jobs.length, 1);
    assert.equal(jobsPayload.jobs[0].id, createPayload.job.id);
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
    await rm(inputDirectory, { recursive: true, force: true });
    clearPreviewHistory();
    clearRenderJobs();
  }
});

test("listRenderJobs returns newest jobs first", async () => {
  clearPreviewHistory();
  clearRenderJobs();
  createManualPreview(
    {
      participants: [
        {
          name: "Alpha",
          email: "alpha@example.com",
        },
      ],
    },
    now,
  );

  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-renders-"));
  const inputDirectory = await mkdtemp(join(tmpdir(), "pick-me-maybe-render-inputs-"));
  const server = createApiServer({
    renderDirectory: directory,
    renderInputDirectory: inputDirectory,
    renderLatest: async (outputPath) => {
      await writeFile(outputPath, createMp4Fixture());

      return {
        stdout: "job rendered",
        stderr: "",
      };
    },
  });
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");

    const first = await fetch(`http://127.0.0.1:${address.port}/api/render-latest-jobs`, {
      method: "POST",
    });
    const firstPayload = await first.json();
    await waitForRenderJob(address.port, firstPayload.job.id);

    const second = await fetch(`http://127.0.0.1:${address.port}/api/render-latest-jobs`, {
      method: "POST",
    });
    const secondPayload = await second.json();
    await waitForRenderJob(address.port, secondPayload.job.id);

    const jobs = listRenderJobs();
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].id, secondPayload.job.id);
    assert.equal(jobs[1].id, firstPayload.job.id);
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
    await rm(inputDirectory, { recursive: true, force: true });
    clearPreviewHistory();
    clearRenderJobs();
  }
});

test("createApiServer records failed latest render jobs", async () => {
  clearPreviewHistory();
  clearRenderJobs();
  createManualPreview(
    {
      participants: [
        {
          name: "Alpha",
          email: "alpha@example.com",
        },
      ],
    },
    now,
  );

  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-renders-"));
  const inputDirectory = await mkdtemp(join(tmpdir(), "pick-me-maybe-render-inputs-"));
  const server = createApiServer({
    renderDirectory: directory,
    renderInputDirectory: inputDirectory,
    renderLatest: async () => {
      throw new Error("render failed");
    },
  });
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");

    const createResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/render-latest-jobs`,
      {
        method: "POST",
      },
    );
    const createPayload = await createResponse.json();
    const completed = await waitForRenderJob(address.port, createPayload.job.id);

    assert.equal(completed.status, "failed");
    assert.equal(completed.error, "render failed");
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
    await rm(inputDirectory, { recursive: true, force: true });
    clearPreviewHistory();
    clearRenderJobs();
  }
});

test("createApiServer rejects latest render without a preview", async () => {
  clearPreviewHistory();
  const server = createApiServer({
    renderLatest: async () => {
      throw new Error("Should not render without preview.");
    },
  });
  await listen(server);

  try {
    const address = server.address();
    assert.equal(typeof address, "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/render-latest`, {
      method: "POST",
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, "No latest raffle preview is available to render.");
  } finally {
    await close(server);
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

test("listFaceResources returns supported image resources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-faces-"));

  try {
    await writeFile(join(directory, "Alpha.svg"), "<svg></svg>");
    await writeFile(join(directory, "Beta.png"), "");
    await writeFile(join(directory, "notes.txt"), "ignored");

    assert.deepEqual(await listFaceResources(directory), [
      {
        fileName: "Alpha.svg",
        key: "Alpha.svg",
        path: join(directory, "Alpha.svg").replaceAll("\\", "/"),
        format: "svg",
      },
      {
        fileName: "Beta.png",
        key: "Beta.png",
        path: join(directory, "Beta.png").replaceAll("\\", "/"),
        format: "png",
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

async function waitForRenderJob(port, jobId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:${port}/api/render-jobs/${jobId}`);
    const payload = await response.json();

    if (payload.job.status === "done" || payload.job.status === "failed") {
      return payload.job;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Render job did not finish: ${jobId}`);
}

function createMp4Fixture() {
  return Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypmp42"),
    Buffer.alloc(2048),
  ]);
}
