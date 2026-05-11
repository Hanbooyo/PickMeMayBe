import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { matchVisualAssets, type ImageResource } from "../../../packages/asset-matcher/src/index.js";
import { createElectionBroadcastScenario } from "../../../packages/presentation-engine/src/index.js";
import { drawWinners } from "../../../packages/raffle-engine/src/index.js";
import { createElectionBroadcastRenderProps } from "../../../packages/render-types/src/index.js";
import { normalizeManualInputs } from "../../../packages/roster-import/src/index.js";
import { createRendererPreviewModel } from "../../renderer/src/index.js";

import type { ManualParticipantInput } from "../../../packages/shared/src/index.js";

export type ManualPreviewRequest = {
  participants: ManualParticipantInput[];
  resources?: ImageResource[];
  anonymousImagePath?: string;
  title?: string;
  winnerCount?: number;
};

export type ManualPreviewResponse = {
  participants: ReturnType<typeof normalizeManualInputs>["participants"];
  visualAssets: ReturnType<typeof matchVisualAssets>;
  raffleResult: ReturnType<typeof drawWinners>;
  scenario: ReturnType<typeof createElectionBroadcastScenario>;
  preview: ReturnType<typeof createRendererPreviewModel>;
};

const defaultResources: ImageResource[] = [
  {
    key: "김민수.png",
    path: "resources/faces/김민수.png",
  },
  {
    key: "이서연.png",
    path: "resources/faces/이서연.png",
  },
  {
    key: "박지훈.png",
    path: "resources/faces/박지훈.png",
  },
];

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
        request.anonymousImagePath ?? "resources/faces/anonymous.png",
    },
  );
  const raffleResult = drawWinners({
    id: "api-preview-raffle",
    participants: normalized.participants,
    options: {
      winnerCount: request.winnerCount ?? 1,
      allowPreviousWinners: true,
    },
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
  const preview = createRendererPreviewModel(renderProps);

  return {
    participants: normalized.participants,
    visualAssets,
    raffleResult,
    scenario,
    preview,
  };
}

export function createApiServer() {
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (request.method === "POST" && request.url === "/api/manual-preview") {
        const body = (await readJsonBody(request)) as ManualPreviewRequest;
        sendJson(response, 200, createManualPreview(body));
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Unknown API error.",
      });
    }
  });
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
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
