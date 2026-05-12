import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import * as XLSX from "xlsx";

import { matchVisualAssets, type ImageResource } from "../../../packages/asset-matcher/src/index.js";
import { createElectionBroadcastScenario } from "../../../packages/presentation-engine/src/index.js";
import {
  drawWinners,
  RaffleEngineError,
} from "../../../packages/raffle-engine/src/index.js";
import {
  createElectionBroadcastRenderProps,
  type ElectionBroadcastRenderProps,
} from "../../../packages/render-types/src/index.js";
import { validateMp4RenderArtifact } from "../../../packages/render-validation/src/index.js";
import {
  normalizeManualInputs,
  parseRosterTable,
} from "../../../packages/roster-import/src/index.js";
import { createRendererPreviewModel } from "../../renderer/src/index.js";
import {
  addHistoryEntry,
  createHistoryEntryFromScenario,
  type RaffleHistoryEntry,
} from "../../../packages/history/src/index.js";

import type { ManualParticipantInput } from "../../../packages/shared/src/index.js";

export type ManualPreviewRequest = {
  participants: ManualParticipantInput[];
  resources?: ImageResource[];
  anonymousImagePath?: string;
  title?: string;
  winnerCount?: number;
  allowPreviousWinners?: boolean;
  previousWinnerIds?: string[];
};

export type RosterFileParseRequest = {
  fileBase64: string;
};

export type RenderArtifactSummary = {
  fileName: string;
  path: string;
  sizeBytes: number;
  format: "mp4";
};

export type ApiServerOptions = {
  renderDirectory?: string;
  renderInputDirectory?: string;
  renderSample?: RenderSampleRunner;
  renderLatest?: RenderLatestRunner;
};

export type RenderSampleRunner = () => Promise<RenderSampleResult>;
export type RenderLatestRunner = (
  outputPath: string,
  inputPropsPath: string,
) => Promise<RenderSampleResult>;

export type RenderSampleResult = {
  stdout: string;
  stderr: string;
};

export type RenderJobStatus = "queued" | "running" | "done" | "failed";

export type RenderJob = {
  id: string;
  status: RenderJobStatus;
  createdAt: string;
  updatedAt: string;
  outputPath?: string;
  inputPropsPath?: string;
  result?: RenderSampleResult;
  error?: string;
  renders?: RenderArtifactSummary[];
};

export type ManualPreviewResponse = {
  participants: ReturnType<typeof normalizeManualInputs>["participants"];
  visualAssets: ReturnType<typeof matchVisualAssets>;
  raffleResult: ReturnType<typeof drawWinners>;
  scenario: ReturnType<typeof createElectionBroadcastScenario>;
  preview: ReturnType<typeof createRendererPreviewModel>;
  history: RaffleHistoryEntry[];
};

const defaultResources: ImageResource[] = [
  {
    key: "김민수.svg",
    path: "resources/faces/김민수.svg",
  },
  {
    key: "이서연.svg",
    path: "resources/faces/이서연.svg",
  },
  {
    key: "박지훈.svg",
    path: "resources/faces/박지훈.svg",
  },
];
let previewHistory: RaffleHistoryEntry[] = [];
let latestRenderProps: ElectionBroadcastRenderProps | undefined;
const renderJobs = new Map<string, RenderJob>();

export function createManualPreview(
  request: ManualPreviewRequest,
  now = new Date().toISOString(),
): ManualPreviewResponse {
  const normalized = normalizeManualInputs(request.participants, {
    importedAt: now,
  });

  if (normalized.errors.length > 0) {
    throw new Error(
      normalized.errors
        .map((error) => `${error.index + 1} row: ${error.message}`)
        .join(" / "),
    );
  }

  const visualAssets = matchVisualAssets(
    normalized.participants,
    request.resources ?? defaultResources,
    {
      anonymousImagePath:
        request.anonymousImagePath ?? "resources/faces/anonymous.svg",
    },
  );
  const raffleResult = drawWinners({
    id: "api-preview-raffle",
    participants: normalized.participants,
    options: {
      winnerCount: request.winnerCount ?? 1,
      allowPreviousWinners: request.allowPreviousWinners ?? true,
    },
    previousWinnerIds: request.previousWinnerIds,
    createdAt: now,
  });
  const scenario = createElectionBroadcastScenario({
    id: "api-preview-scenario",
    title: request.title ?? "PickMeMaybe LIVE",
    raffleResult,
    participants: normalized.participants,
    visualAssets,
    durationSeconds: 10,
  });
  const renderProps = createElectionBroadcastRenderProps(scenario);
  latestRenderProps = renderProps;
  const preview = createRendererPreviewModel(renderProps);
  previewHistory = addHistoryEntry(
    previewHistory,
    createHistoryEntryFromScenario(scenario, now),
  );

  return {
    participants: normalized.participants,
    visualAssets,
    raffleResult,
    scenario,
    preview,
    history: previewHistory,
  };
}

export function getPreviewHistory(): RaffleHistoryEntry[] {
  return [...previewHistory];
}

export function clearPreviewHistory(): void {
  previewHistory = [];
  latestRenderProps = undefined;
}

export function clearRenderJobs(): void {
  renderJobs.clear();
}

export function getRenderJob(jobId: string): RenderJob | undefined {
  const job = renderJobs.get(jobId);

  return job ? { ...job, renders: job.renders ? [...job.renders] : undefined } : undefined;
}

export function listRenderJobs(): RenderJob[] {
  return [...renderJobs.values()]
    .map((job) => ({
      ...job,
      renders: job.renders ? [...job.renders] : undefined,
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listRenderArtifacts(
  renderDirectory = "data/renders",
): Promise<RenderArtifactSummary[]> {
  const directory = resolve(renderDirectory);
  const entries = await readdir(directory, {
    withFileTypes: true,
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  });
  const artifacts: RenderArtifactSummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".mp4")) {
      continue;
    }

    const artifactPath = join(directory, entry.name);
    const validation = await validateMp4RenderArtifact(artifactPath);
    artifacts.push({
      fileName: entry.name,
      path: artifactPath,
      sizeBytes: validation.sizeBytes,
      format: validation.format,
    });
  }

  return artifacts.sort((left, right) => left.fileName.localeCompare(right.fileName));
}

export function createApiServer(options: ApiServerOptions = {}) {
  const renderDirectory = options.renderDirectory ?? "data/renders";
  const renderInputDirectory = options.renderInputDirectory ?? "data/render-inputs";
  const renderSample = options.renderSample ?? runSampleRenderCommand;
  const renderLatest = options.renderLatest ?? runLatestRenderCommand;

  return createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        sendEmpty(response, 204);
        return;
      }

      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (request.method === "GET" && request.url === "/api/history") {
        sendJson(response, 200, { history: getPreviewHistory() });
        return;
      }

      if (request.method === "GET" && request.url === "/api/renders") {
        sendJson(response, 200, {
          renders: await listRenderArtifacts(renderDirectory),
        });
        return;
      }

      if (request.method === "GET" && request.url?.startsWith("/api/renders/")) {
        const fileName = decodeURIComponent(request.url.slice("/api/renders/".length));
        await sendRenderArtifact(response, renderDirectory, fileName);
        return;
      }

      if (request.method === "POST" && request.url === "/api/manual-preview") {
        const body = (await readJsonBody(request)) as ManualPreviewRequest;
        sendJson(response, 200, createManualPreview(body));
        return;
      }

      if (request.method === "POST" && request.url === "/api/parse-roster-file") {
        const body = (await readJsonBody(request)) as RosterFileParseRequest;
        sendJson(response, 200, {
          rows: parseRosterFile(body.fileBase64),
        });
        return;
      }

      if (request.method === "POST" && request.url === "/api/render-sample") {
        const result = await renderSample();
        sendJson(response, 200, {
          render: result,
          renders: await listRenderArtifacts(renderDirectory),
        });
        return;
      }

      if (request.method === "POST" && request.url === "/api/render-latest") {
        const renderInput = await createLatestRenderInput(
          renderDirectory,
          renderInputDirectory,
        );
        const result = await renderLatest(
          renderInput.outputPath,
          renderInput.inputPropsPath,
        );
        sendJson(response, 200, {
          render: result,
          renders: await listRenderArtifacts(renderDirectory),
        });
        return;
      }

      if (request.method === "POST" && request.url === "/api/render-latest-jobs") {
        const job = await enqueueLatestRenderJob({
          renderDirectory,
          renderInputDirectory,
          renderLatest,
        });
        sendJson(response, 202, { job });
        return;
      }

      if (request.method === "GET" && request.url === "/api/render-jobs") {
        sendJson(response, 200, { jobs: listRenderJobs() });
        return;
      }

      if (request.method === "GET" && request.url?.startsWith("/api/render-jobs/")) {
        const jobId = decodeURIComponent(request.url.slice("/api/render-jobs/".length));
        const job = getRenderJob(jobId);

        if (!job) {
          sendJson(response, 404, { error: "Render job not found." });
          return;
        }

        sendJson(response, 200, { job });
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 400, createErrorPayload(error));
    }
  });
}

async function enqueueLatestRenderJob({
  renderDirectory,
  renderInputDirectory,
  renderLatest,
}: {
  renderDirectory: string;
  renderInputDirectory: string;
  renderLatest: RenderLatestRunner;
}): Promise<RenderJob> {
  const renderInput = await createLatestRenderInput(
    renderDirectory,
    renderInputDirectory,
  );
  const now = new Date().toISOString();
  const job: RenderJob = {
    id: randomUUID(),
    status: "queued",
    createdAt: now,
    updatedAt: now,
    outputPath: renderInput.outputPath,
    inputPropsPath: renderInput.inputPropsPath,
  };
  renderJobs.set(job.id, job);

  setImmediate(() => {
    void runRenderJob(job.id, renderDirectory, renderLatest);
  });

  return { ...job };
}

async function runRenderJob(
  jobId: string,
  renderDirectory: string,
  renderLatest: RenderLatestRunner,
): Promise<void> {
  const job = renderJobs.get(jobId);

  if (!job?.outputPath || !job.inputPropsPath) {
    return;
  }

  updateRenderJob(jobId, {
    status: "running",
  });

  try {
    const result = await renderLatest(job.outputPath, job.inputPropsPath);
    const renders = await listRenderArtifacts(renderDirectory);
    updateRenderJob(jobId, {
      status: "done",
      result,
      renders,
    });
  } catch (error) {
    updateRenderJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown render job error.",
    });
  }
}

function updateRenderJob(
  jobId: string,
  patch: Partial<Omit<RenderJob, "id" | "createdAt">>,
): void {
  const current = renderJobs.get(jobId);

  if (!current) {
    return;
  }

  renderJobs.set(jobId, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

async function runSampleRenderCommand(): Promise<RenderSampleResult> {
  const { stdout, stderr } = await promisify(execFile)(
    "npm.cmd",
    ["run", "render:sample"],
    {
      cwd: process.cwd(),
      timeout: 600_000,
      windowsHide: true,
    },
  );

  return {
    stdout,
    stderr,
  };
}

async function createLatestRenderInput(
  renderDirectory: string,
  inputDirectory: string,
): Promise<{
  outputPath: string;
  inputPropsPath: string;
}> {
  if (!latestRenderProps) {
    throw new Error("No latest raffle preview is available to render.");
  }

  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const outputPath = join(renderDirectory, `election-broadcast-${timestamp}.mp4`);
  const inputPropsPath = join(inputDirectory, `latest-${timestamp}.json`);

  await mkdir(renderDirectory, { recursive: true });
  await mkdir(inputDirectory, { recursive: true });
  await writeFile(inputPropsPath, JSON.stringify(latestRenderProps, null, 2));

  return {
    outputPath,
    inputPropsPath,
  };
}

async function runLatestRenderCommand(
  outputPath: string,
  inputPropsPath: string,
): Promise<RenderSampleResult> {
  const { stdout, stderr } = await promisify(execFile)(
    "npm.cmd",
    ["run", "render:sample", "--", outputPath, inputPropsPath],
    {
      cwd: process.cwd(),
      timeout: 600_000,
      windowsHide: true,
    },
  );

  return {
    stdout,
    stderr,
  };
}

async function sendRenderArtifact(
  response: ServerResponse,
  renderDirectory: string,
  fileName: string,
): Promise<void> {
  if (fileName !== basename(fileName) || !fileName.toLowerCase().endsWith(".mp4")) {
    sendJson(response, 404, { error: "Render artifact not found." });
    return;
  }

  const artifactPath = resolve(renderDirectory, fileName);
  const artifact = await validateMp4RenderArtifact(artifactPath);

  response.writeHead(200, {
    "content-type": "video/mp4",
    "content-length": String(artifact.sizeBytes),
    "content-disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });

  await new Promise<void>((resolveStream, rejectStream) => {
    const stream = createReadStream(artifactPath);
    stream.once("error", rejectStream);
    response.once("error", rejectStream);
    response.once("finish", resolveStream);
    stream.pipe(response);
  });
}

export function parseRosterFile(fileBase64: string) {
  const workbook = XLSX.read(Buffer.from(fileBase64, "base64"), {
    type: "buffer",
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Workbook does not contain any sheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const table = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
  });

  return parseRosterTable(table);
}

function createErrorPayload(error: unknown): {
  error: string;
  code: string;
} {
  if (error instanceof RaffleEngineError) {
    return {
      error: error.message,
      code: error.code,
    };
  }

  return {
    error: error instanceof Error ? error.message : "Unknown API error.",
    code: "UNKNOWN_ERROR",
  };
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendEmpty(response: ServerResponse, statusCode: number): void {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end();
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

if (isApiEntrypoint(process.argv[1])) {
  const port = Number(process.env.PORT ?? 4317);
  createApiServer().listen(port, () => {
    console.log(`PickMeMaybe API listening on http://localhost:${port}`);
  });
}

function isApiEntrypoint(entrypoint: string | undefined): boolean {
  return (
    entrypoint?.replaceAll("\\", "/").endsWith("dist/apps/api/src/index.js") ??
    false
  );
}
