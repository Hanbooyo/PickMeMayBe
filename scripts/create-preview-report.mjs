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
  ],
  {
    anonymousImagePath: "resources/faces/anonymous.svg",
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

await writeFile(
  "reports/preview.html",
  createPreviewHtml({
    title: scenario.title,
    cards: scenario.cards,
    winnerIds: scenario.winnerIds,
    keyFrames: preview.keyFrames,
    totalFrames: preview.totalFrames,
    fps: preview.fps,
  }),
);

console.log("Preview report created: reports/preview-report.json");
console.log("Preview HTML created: reports/preview.html");

function createPreviewHtml(input) {
  const winnerIdSet = new Set(input.winnerIds);
  const winnerCards = input.cards.filter((card) =>
    winnerIdSet.has(card.participantId),
  );
  const headline = winnerCards
    .map((card) => card.name)
    .join(", ");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Arial, "Noto Sans KR", sans-serif;
      background: #0f172a;
      color: #e5e7eb;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.92)),
        radial-gradient(circle at 70% 20%, rgba(239, 68, 68, 0.22), transparent 32%);
    }

    main {
      width: min(1180px, calc(100vw - 48px));
      aspect-ratio: 16 / 9;
      border: 1px solid rgba(148, 163, 184, 0.3);
      background: rgba(2, 6, 23, 0.78);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.34);
      display: grid;
      grid-template-rows: auto 1fr auto;
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 22px 28px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.78);
    }

    h1 {
      margin: 0;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: 0;
    }

    .live {
      color: #fecaca;
      font-weight: 800;
      border: 1px solid rgba(248, 113, 113, 0.55);
      padding: 8px 12px;
      border-radius: 6px;
    }

    .content {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 24px;
      padding: 28px;
      min-height: 0;
    }

    .ranking {
      display: grid;
      gap: 14px;
      align-content: start;
    }

    .candidate {
      display: grid;
      grid-template-columns: 74px 1fr auto;
      align-items: center;
      gap: 16px;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.64);
      border-radius: 8px;
    }

    .candidate.winner {
      border-color: rgba(250, 204, 21, 0.9);
      background: linear-gradient(90deg, rgba(113, 63, 18, 0.58), rgba(15, 23, 42, 0.75));
    }

    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      object-fit: cover;
      background: #1f2937;
      border: 1px solid rgba(226, 232, 240, 0.24);
    }

    .name {
      font-size: 22px;
      font-weight: 800;
    }

    .meta {
      margin-top: 4px;
      color: #cbd5e1;
      font-size: 14px;
    }

    .bar {
      width: 130px;
      height: 12px;
      background: rgba(148, 163, 184, 0.25);
      overflow: hidden;
      border-radius: 999px;
    }

    .bar span {
      display: block;
      height: 100%;
      width: 72%;
      background: linear-gradient(90deg, #38bdf8, #facc15);
    }

    .winner-panel {
      display: grid;
      align-content: center;
      justify-items: center;
      text-align: center;
      border-left: 1px solid rgba(148, 163, 184, 0.18);
      padding-left: 24px;
    }

    .winner-label {
      color: #fde68a;
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 10px;
    }

    .winner-name {
      font-size: 54px;
      font-weight: 900;
      line-height: 1.05;
    }

    .frames {
      margin-top: 24px;
      display: grid;
      gap: 8px;
      color: #cbd5e1;
      font-size: 13px;
    }

    footer {
      padding: 14px 28px;
      background: rgba(185, 28, 28, 0.95);
      font-weight: 800;
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(input.title)}</h1>
      <div class="live">LIVE RAFFLE</div>
    </header>
    <section class="content">
      <div class="ranking">
        ${input.cards.map((card) => createCandidateHtml(card, winnerIdSet)).join("\n")}
      </div>
      <aside class="winner-panel">
        <div class="winner-label">최종 당첨 확정</div>
        <div class="winner-name">${escapeHtml(headline)}</div>
        <div class="frames">
          <div>${input.totalFrames} frames · ${input.fps} fps</div>
          ${input.keyFrames.map((frame) => `<div>${frame.frame}f · ${escapeHtml(frame.activeEventType)}</div>`).join("\n")}
        </div>
      </aside>
    </section>
    <footer>
      <span>속보: PickMeMaybe 추첨 집계 완료</span>
      <span>공정 추첨 결과 기반 연출 화면</span>
    </footer>
  </main>
</body>
</html>
`;
}

function createCandidateHtml(card, winnerIdSet) {
  const isWinner = winnerIdSet.has(card.participantId);
  const meta = [card.department, card.appliedAsset].filter(Boolean).join(" · ");

  return `<article class="candidate ${isWinner ? "winner" : ""}">
  <img class="avatar" src="../${escapeHtml(card.imagePath)}" alt="" />
  <div>
    <div class="name">${escapeHtml(card.name)}</div>
    <div class="meta">${escapeHtml(meta)}</div>
  </div>
  <div class="bar"><span></span></div>
</article>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
