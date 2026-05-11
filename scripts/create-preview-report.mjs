import { mkdir, writeFile } from "node:fs/promises";

import { matchVisualAssets } from "../dist/packages/asset-matcher/src/index.js";
import { createElectionBroadcastScenario } from "../dist/packages/presentation-engine/src/index.js";
import { drawWinners } from "../dist/packages/raffle-engine/src/index.js";
import { createElectionBroadcastRenderProps } from "../dist/packages/render-types/src/index.js";
import { normalizeManualInputs } from "../dist/packages/roster-import/src/index.js";
import { createRendererPreviewModel } from "../dist/apps/renderer/src/index.js";

const importedAt = "2026-05-11T00:00:00.000Z";

function firstIndexRandomInt() {
  return 0;
}

const normalized = normalizeManualInputs(
  [
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
    {
      name: "박지훈",
      email: "jihoon@example.com",
      department: "개발팀",
      appliedAsset: "상품 C",
    },
  ],
  { importedAt },
);

if (normalized.errors.length > 0) {
  throw new Error(`Preview roster has validation errors.`);
}

const visualAssets = matchVisualAssets(
  normalized.participants,
  [
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
  ],
  {
    anonymousImagePath: "resources/faces/anonymous.png",
  },
);

const raffleResult = drawWinners({
  id: "raffle-demo-1",
  participants: normalized.participants,
  options: {
    winnerCount: 1,
    allowPreviousWinners: true,
  },
  createdAt: importedAt,
  randomInt: firstIndexRandomInt,
});

const scenario = createElectionBroadcastScenario({
  id: "scenario-demo-1",
  title: "PickMeMaybe LIVE",
  raffleResult,
  participants: normalized.participants,
  visualAssets,
  durationSeconds: 10,
});

const renderProps = createElectionBroadcastRenderProps(scenario);
const preview = createRendererPreviewModel(renderProps);

await mkdir("reports", { recursive: true });
await writeFile(
  "reports/preview-report.json",
  `${JSON.stringify(
    {
      participants: normalized.participants,
      visualAssets,
      raffleResult,
      scenario,
      preview,
    },
    null,
    2,
  )}\n`,
);

console.log("Preview report created: reports/preview-report.json");
