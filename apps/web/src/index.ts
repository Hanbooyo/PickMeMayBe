import {
  addManualInputRow,
  createEmptyManualInput,
  normalizeManualInputs,
  parseRosterText,
  removeManualInputRow,
  updateManualInputRow,
} from "../../../packages/roster-import/src/index.js";

import type { ManualParticipantInput } from "../../../packages/shared/src/index.js";
import type { RaffleHistoryEntry } from "../../../packages/history/src/index.js";
import type { ElectionBroadcastScenario } from "../../../packages/presentation-engine/src/index.js";
import {
  createShowPlan,
  type DiceShowPlan,
  type RaceShowPlan,
  type RollingShowPlan,
  type RpsShowPlan,
  type VoteShowPlan,
} from "../../../packages/show-engine/src/index.js";

const importedAt = new Date().toISOString();
const manualPreviewEndpoint = "http://localhost:4317/api/manual-preview";
const historyEndpoint = "http://localhost:4317/api/history";
const parseRosterFileEndpoint = "http://localhost:4317/api/parse-roster-file";
const faceResourcesEndpoint = "http://localhost:4317/api/resources/faces";
const processAnimationDurationMs = 10000;
let inputs: ManualParticipantInput[] = [
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
];
let resultHistory: RaffleHistoryEntry[] = [];

const table = getElement("participant-table");
const preview = getElement("preview");
const errorMessage = getElement("error-message");
const apiStatus = getElement("api-status");
const history = getElement("history");
const resourceSummary = getElement("resource-summary");
const assetMatchSummary = getElement("asset-match-summary");
const assetMatchList = getElement("asset-match-list");
const runPreviewButton = getElement("run-preview") as HTMLButtonElement;
const inputTabButton = getElement("tab-input") as HTMLButtonElement;
const drawTabButton = getElement("tab-draw") as HTMLButtonElement;
const inputPanel = getElement("panel-input");
const drawPanel = getElement("panel-draw");
const winnerCountInput = getElement("winner-count") as HTMLInputElement;
const presentationModeInput = getElement("presentation-mode") as HTMLSelectElement;
const pasteRosterInput = getElement("paste-roster") as HTMLTextAreaElement;
const rosterFileInput = getElement("roster-file") as HTMLInputElement;
const allowPreviousWinnersInput = getElement(
  "allow-previous-winners",
) as HTMLInputElement;

getElement("add-row").addEventListener("click", () => {
  inputs = addManualInputRow(inputs);
  render();
});

getElement("remove-last-row").addEventListener("click", () => {
  if (inputs.length <= 1) {
    setError("참가자는 최소 1명 이상 필요합니다.");
    return;
  }

  inputs = removeManualInputRow(inputs, inputs.length - 1);
  render();
});

getElement("run-preview").addEventListener("click", async () => {
  await runPreview();
});

getElement("apply-paste").addEventListener("click", () => {
  applyPastedRoster();
});

getElement("apply-file").addEventListener("click", async () => {
  await applyRosterFile();
});

inputTabButton.addEventListener("click", () => {
  setActiveTab("input");
});

drawTabButton.addEventListener("click", () => {
  setActiveTab("draw");
});

render();
void checkApiStatus();
void loadHistory();
void loadFaceResources();
void runPreview();

function render(): void {
  table.innerHTML = "";
  errorMessage.textContent = "";

  const head = document.createElement("div");
  head.className = "row head";
  head.innerHTML = `
    <div>No</div>
    <div>이름</div>
    <div>이메일</div>
    <div>부서</div>
    <div>응모자산</div>
    <div></div>
  `;
  table.append(head);

  inputs.forEach((input, index) => {
    const row = document.createElement("div");
    row.className = "row";
    row.append(
      createNumberCell(index),
      createInput(index, "name", input.name),
      createInput(index, "email", input.email ?? ""),
      createInput(index, "department", input.department ?? ""),
      createInput(index, "appliedAsset", input.appliedAsset ?? ""),
      createDeleteButton(index),
    );
    table.append(row);
  });
}

function setActiveTab(tab: "input" | "draw"): void {
  const isInput = tab === "input";

  inputTabButton.classList.toggle("active", isInput);
  drawTabButton.classList.toggle("active", !isInput);
  inputPanel.classList.toggle("active", isInput);
  drawPanel.classList.toggle("active", !isInput);
}

async function runPreview(): Promise<void> {
  setBusy(true);

  try {
    setError("");
    const normalized = normalizeManualInputs(inputs, { importedAt });
    const winnerCount = readWinnerCount();

    if (normalized.errors.length > 0) {
      setError(
        normalized.errors
          .map((error) => `${error.index + 1}행: ${error.message}`)
          .join(" / "),
      );
      setBusy(false);
      return;
    }

    const presentationMode = readPresentationMode();
    setActiveTab("draw");

    const response = await fetch(manualPreviewEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        participants: normalized.participants.map((participant) => ({
          name: participant.name,
          email: participant.email,
          department: participant.department,
          appliedAsset: participant.appliedAsset,
        })),
        title: "PickMeMaybe LIVE",
        winnerCount,
        presentationMode,
        allowPreviousWinners: allowPreviousWinnersInput.checked,
        previousWinnerIds: resultHistory.flatMap((entry) => entry.winnerIds),
      }),
    });

    const payload = (await response.json()) as ManualPreviewApiResponse;

    if (!response.ok) {
      throw new Error(formatApiError(payload));
    }

    renderProcessPreview(payload.scenario, processAnimationDurationMs);
    await delay(processAnimationDurationMs);
    renderPreview(payload.scenario);
    renderAssetMatches(payload.scenario.cards, payload.visualAssets);
    resultHistory = payload.history;
    renderHistory();
    setApiStatus("ready", "API 연결됨");
  } catch (error) {
    setApiStatus("error", "API 연결 실패");
    setError(
      error instanceof Error
        ? `${error.message} API 서버가 실행 중인지 확인하세요: npm.cmd run demo:api`
        : "Unknown preview error.",
    );
  } finally {
    setBusy(false);
  }
}

function applyPastedRoster(): void {
  try {
    const rows = parseRosterText(pasteRosterInput.value);

    if (rows.length === 0) {
      setError("붙여넣은 명단이 없습니다.");
      return;
    }

    inputs = rows.map((row) => ({
      name: row.name,
      ...(row.email ? { email: row.email } : {}),
      ...(row.department ? { department: row.department } : {}),
      ...(row.appliedAsset ? { appliedAsset: row.appliedAsset } : {}),
    }));
    render();
    setError("");
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "붙여넣기 명단을 처리할 수 없습니다.",
    );
  }
}

async function applyRosterFile(): Promise<void> {
  try {
    const file = rosterFileInput.files?.[0];

    if (!file) {
      setError("적용할 Excel 파일을 선택하세요.");
      return;
    }

    const fileBase64 = await readFileAsBase64(file);
    const response = await fetch(parseRosterFileEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ fileBase64 }),
    });
    const payload = (await response.json()) as {
      rows?: Array<{
        name: string;
        email?: string;
        department?: string;
        appliedAsset?: string;
      }>;
      error?: string;
    };

    if (!response.ok || !payload.rows) {
      throw new Error(payload.error ?? "Excel 파일을 처리할 수 없습니다.");
    }

    if (payload.rows.length === 0) {
      setError("Excel 파일에서 참가자 명단을 찾지 못했습니다.");
      return;
    }

    inputs = payload.rows.map((row) => ({
      name: row.name,
      ...(row.email ? { email: row.email } : {}),
      ...(row.department ? { department: row.department } : {}),
      ...(row.appliedAsset ? { appliedAsset: row.appliedAsset } : {}),
    }));
    render();
    setError("");
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Excel 파일을 처리할 수 없습니다.",
    );
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result);
      resolve(result.split(",")[1] ?? "");
    });
    reader.addEventListener("error", () => {
      reject(new Error("Excel 파일을 읽을 수 없습니다."));
    });
    reader.readAsDataURL(file);
  });
}

function readWinnerCount(): number {
  const winnerCount = Number(winnerCountInput.value);

  if (!Number.isInteger(winnerCount) || winnerCount <= 0) {
    throw new Error("당첨 인원은 1명 이상이어야 합니다.");
  }

  return winnerCount;
}

type BroadcastPresentationMode =
  | "random"
  | "dice-roll"
  | "rock-paper-scissors"
  | "vote-count"
  | "running-race"
  | "rolling-picker"
  | "ladder-game";

function readPresentationMode(): BroadcastPresentationMode {
  const concreteModes: Array<Exclude<BroadcastPresentationMode, "random">> = [
    "dice-roll",
    "rock-paper-scissors",
    "vote-count",
    "running-race",
    "rolling-picker",
  ];
  const modes = new Set<BroadcastPresentationMode>(["random", ...concreteModes]);

  if (modes.has(presentationModeInput.value as BroadcastPresentationMode)) {
    const selectedMode = presentationModeInput.value as BroadcastPresentationMode;

    if (selectedMode === "random") {
      return concreteModes[randomIntFromCrypto() % concreteModes.length];
    }

    return selectedMode;
  }

  return concreteModes[randomIntFromCrypto() % concreteModes.length];
}

async function checkApiStatus(): Promise<void> {
  try {
    const response = await fetch("http://localhost:4317/health");
    if (!response.ok) {
      throw new Error("Health check failed.");
    }

    setApiStatus("ready", "API 연결됨");
  } catch {
    setApiStatus("error", "API 연결 실패");
  }
}

async function loadHistory(): Promise<void> {
  try {
    const response = await fetch(historyEndpoint);

    if (!response.ok) {
      throw new Error("History request failed.");
    }

    const payload = (await response.json()) as {
      history: RaffleHistoryEntry[];
    };
    resultHistory = payload.history;
    renderHistory();
  } catch {
    resultHistory = [];
    renderHistory();
  }
}

async function loadFaceResources(): Promise<void> {
  try {
    const response = await fetch(faceResourcesEndpoint);

    if (!response.ok) {
      throw new Error("Face resource request failed.");
    }

    const payload = (await response.json()) as {
      resources: FaceResourceSummary[];
    };
    renderFaceResources(payload.resources);
  } catch {
    resourceSummary.innerHTML = "Face resources are not available.";
  }
}

type ManualPreviewApiResponse = {
  error?: string;
  code?: string;
  scenario: ElectionBroadcastScenario;
  visualAssets: VisualAssetSummary[];
  history: RaffleHistoryEntry[];
};

type VisualAssetSummary = {
  participantId: string;
  imagePath: string;
  status: "matched" | "anonymous";
  matchedBy: "name" | "email" | "name-and-department" | "fallback";
};

type FaceResourceSummary = {
  fileName: string;
  key: string;
  path: string;
  format: "svg" | "png" | "jpg" | "jpeg" | "webp";
};

function formatApiError(payload: ManualPreviewApiResponse): string {
  switch (payload.code) {
    case "WINNER_COUNT_EXCEEDS_ELIGIBLE_COUNT":
      return "당첨 인원이 추첨 가능한 참가자 수보다 많습니다.";
    case "NO_ELIGIBLE_PARTICIPANTS":
      return "과거 당첨자 제외 조건 때문에 추첨 가능한 참가자가 없습니다.";
    case "INVALID_WINNER_COUNT":
      return "당첨 인원은 1명 이상의 정수여야 합니다.";
    case "DUPLICATE_PARTICIPANT_ID":
      return "중복된 참가자 정보가 있습니다. 이메일 또는 이름/부서를 확인하세요.";
    case "NO_PARTICIPANTS":
      return "참가자를 1명 이상 입력하세요.";
    default:
      return payload.error ?? "API preview request failed.";
  }
}

function renderHistory(): void {
  if (resultHistory.length === 0) {
    history.innerHTML = "";
    return;
  }

  history.innerHTML = `
    <div class="history-title">최근 추첨 결과</div>
    ${resultHistory
      .map(
        (entry) => `
          <div class="history-item">
            <span class="history-winner">${escapeHtml(entry.winnerNames.join(", "))}</span>
            <span class="history-time">${escapeHtml(formatHistoryTime(entry.createdAt))}</span>
          </div>
        `,
      )
      .join("")}
  `;
}

function renderFaceResources(resources: FaceResourceSummary[]): void {
  if (resources.length === 0) {
    resourceSummary.innerHTML = "No face resources found.";
    return;
  }

  const names = resources
    .slice(0, 6)
    .map((resource) => resource.fileName)
    .join(", ");
  const remaining = Math.max(resources.length - 6, 0);

  resourceSummary.innerHTML = `
    <strong>${resources.length}</strong> image resources available
    <div class="resource-files">
      ${escapeHtml(names)}${remaining > 0 ? `, +${remaining} more` : ""}
    </div>
  `;
}

function renderAssetMatches(
  cards: Array<{
    participantId: string;
    name: string;
  }>,
  visualAssets: VisualAssetSummary[],
): void {
  const cardByParticipantId = new Map(
    cards.map((card) => [card.participantId, card]),
  );

  if (visualAssets.length === 0) {
    assetMatchSummary.innerHTML = "";
    assetMatchList.innerHTML = `<div class="empty-state">No asset match data yet.</div>`;
    return;
  }

  const matchedCount = visualAssets.filter((asset) => asset.status === "matched").length;
  const anonymousCount = visualAssets.length - matchedCount;
  assetMatchSummary.innerHTML = `
    <strong>${matchedCount}</strong> matched
    <span class="render-meta">·</span>
    <strong>${anonymousCount}</strong> anonymous fallback
  `;

  assetMatchList.innerHTML = visualAssets
    .map((asset) => {
      const card = cardByParticipantId.get(asset.participantId);
      const status = asset.status === "matched" ? asset.matchedBy : "anonymous";

      return `
        <article class="asset-match-item">
          <div>
            <div class="asset-match-name">${escapeHtml(card?.name ?? asset.participantId)}</div>
            <div class="asset-match-path">${escapeHtml(asset.imagePath)}</div>
          </div>
          <div class="asset-match-status">${escapeHtml(status)}</div>
        </article>
      `;
    })
    .join("");
}

function formatHistoryTime(value: string): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function renderProcessPreview(
  scenario: ElectionBroadcastScenario,
  durationMs: number,
): void {
  const winnerIdSet = new Set(scenario.winnerIds);
  const winnerCards = scenario.cards.filter((card) =>
    winnerIdSet.has(card.participantId),
  );
  const revealMode = scenario.presentationMode ?? "dice-roll";
  const modeLabel = formatPresentationMode(revealMode);

  preview.innerHTML = `
    <div class="winner-only-stage process-stage reveal-${escapeHtml(revealMode)}" style="--process-duration: ${durationMs}ms">
      <div class="mode-chip">${escapeHtml(modeLabel)}</div>
      <div class="reveal-accent">LIVE PROCESS</div>
      ${createProcessMarkup(revealMode, winnerCards, scenario.cards, scenario, durationMs)}
      <div class="suspense-subtitle">Generated raffle result is being revealed through the game flow.</div>
    </div>
  `;
  startProcessAnimation(revealMode);
}

function renderPreview(
  scenario: {
    presentationMode?: BroadcastPresentationMode;
    cards: Array<{
    participantId: string;
    name: string;
    department?: string;
    appliedAsset?: string;
    imagePath: string;
    isWinner: boolean;
    }>;
    winnerIds: string[];
  },
): void {
  const winnerIdSet = new Set(scenario.winnerIds);
  const winnerCards = scenario.cards.filter((card) =>
    winnerIdSet.has(card.participantId),
  );
  const modeLabel = formatPresentationMode(scenario.presentationMode ?? "dice-roll");
  const revealMode = scenario.presentationMode ?? "dice-roll";

  preview.innerHTML = `
    <div class="winner-only-stage reveal-${escapeHtml(revealMode)}">
      <div class="mode-chip">${escapeHtml(modeLabel)}</div>
      ${createRevealAccent(revealMode)}
      ${createModeResultMarkup(revealMode, winnerCards, scenario.cards)}
      <div class="winner-label">당첨 인원 ${winnerCards.length}명</div>
      <div class="winner-grid">
        ${winnerCards.map((card) => createWinnerMarkup(card)).join("")}
      </div>
    </div>
  `;
}

function renderSuspensePreview(
  presentationMode: BroadcastPresentationMode,
  participantCount: number,
  revealDurationMs: number,
): void {
  const modeLabel = formatPresentationMode(presentationMode);
  const visual = createSuspenseVisual(
    presentationMode,
    participantCount,
    revealDurationMs,
  );
  const title = createSuspenseTitle(presentationMode);
  const subtitle = `${participantCount}명의 참가자 중 당첨자를 집계하고 있습니다.`;

  preview.innerHTML = `
    <div class="suspense-stage">
      <div class="mode-chip">${escapeHtml(modeLabel)}</div>
      ${visual}
      <div>
        <div class="suspense-title">${escapeHtml(title)}</div>
        <div class="suspense-subtitle">${escapeHtml(subtitle)} · ${Math.round(revealDurationMs / 1000)}초</div>
      </div>
    </div>
  `;
}

function createSuspenseVisual(
  presentationMode: BroadcastPresentationMode,
  participantCount: number,
  revealDurationMs: number,
): string {
  switch (presentationMode) {
    case "running-race":
      return `
        <div class="race-suspense" style="--race-build-duration: ${revealDurationMs}ms" aria-hidden="true">
          <div class="race-suspense-board">
            <span>START</span>
            <strong>LAST 100M</strong>
            <span>PHOTO FINISH</span>
          </div>
          ${Array.from({ length: Math.max(1, participantCount) })
            .map(
              (_, index) => `
                <div class="race-suspense-lane lane-${index + 1}">
                  <span class="race-suspense-name">#${index + 1}</span>
                  <span class="race-suspense-runner"></span>
                  <span class="race-suspense-ghost"></span>
                </div>
              `,
            )
            .join("")}
          <div class="race-suspense-ticker">
            <span>LEAD CHANGE</span>
            <span>NECK AND NECK</span>
            <span>FINAL PUSH</span>
          </div>
        </div>
      `;
    case "rock-paper-scissors":
      return `
        <div class="rps-stage" aria-hidden="true">
          <span>✊</span>
          <span>✌</span>
          <span>✋</span>
        </div>
      `;
    case "vote-count":
      return `
        <div class="vote-stage" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;
    case "rolling-picker":
      return `
        <div class="rolling-stage" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;
    case "ladder-game":
      return `
        <div class="ladder-stage" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;
    case "random":
    case "dice-roll":
      return `
        <div class="dice-stage" aria-hidden="true">
          <div class="dice">?</div>
          <div class="dice">?</div>
          <div class="dice">?</div>
        </div>
      `;
  }
}

function createRevealAccent(mode: BroadcastPresentationMode): string {
  switch (mode) {
    case "rock-paper-scissors":
      return `<div class="reveal-accent">✊ ✌ ✋</div>`;
    case "vote-count":
      return `<div class="reveal-accent">득표 집계 완료</div>`;
    case "running-race":
      return `<div class="reveal-accent">결승선 통과</div>`;
    case "rolling-picker":
      return `<div class="reveal-accent">롤링 정지</div>`;
    case "ladder-game":
      return `<div class="reveal-accent">사다리 도착</div>`;
    case "random":
    case "dice-roll":
      return `<div class="reveal-accent">주사위 결과 확정</div>`;
  }
}

function createProcessMarkup(
  mode: BroadcastPresentationMode,
  winnerCards: BroadcastCard[],
  cards: BroadcastCard[],
  scenario: ElectionBroadcastScenario,
  durationMs: number,
): string {
  const rng = createRevealRng(winnerCards, cards);

  switch (mode) {
    case "running-race":
      return createRaceProcessMarkup(
        createShowPlan(scenario, { durationMs }) as RaceShowPlan,
      );
    case "rolling-picker":
      return createRollingProcessMarkup(
        createShowPlan(scenario, { durationMs }) as RollingShowPlan,
        cards,
      );
    case "vote-count":
      return createVoteProcessMarkup(
        createShowPlan(scenario, { durationMs }) as VoteShowPlan,
      );
    case "rock-paper-scissors":
      return createRpsProcessMarkup(
        createShowPlan(scenario, { durationMs }) as RpsShowPlan,
      );
    case "ladder-game":
      return createLadderResultMarkup(winnerCards, cards, rng);
    case "random":
    case "dice-roll":
      return createDiceProcessMarkup(
        createShowPlan(scenario, {
          durationMs,
        }) as DiceShowPlan,
      );
  }
}

function createModeResultMarkup(
  mode: BroadcastPresentationMode,
  winnerCards: BroadcastCard[],
  cards: BroadcastCard[],
): string {
  const rng = createRevealRng(winnerCards, cards);

  switch (mode) {
    case "vote-count":
      return createVoteResultMarkup(winnerCards, cards, rng);
    case "running-race":
      return createRaceResultMarkup(winnerCards, cards, rng);
    case "rolling-picker":
      return createRollingResultMarkup(winnerCards, cards, rng);
    case "ladder-game":
      return createLadderResultMarkup(winnerCards, cards, rng);
    case "rock-paper-scissors":
      return createRpsResultMarkup(winnerCards, cards, rng);
    case "random":
    case "dice-roll":
      return createDiceResultMarkup(winnerCards, cards, rng);
  }
}

type BroadcastCard = {
  participantId: string;
  name: string;
  department?: string;
  appliedAsset?: string;
  imagePath: string;
  isWinner: boolean;
};

function createVoteResultMarkup(
  winnerCards: BroadcastCard[],
  cards: BroadcastCard[],
  rng: () => number,
  isProcess = false,
): string {
  const winnerIdSet = new Set(winnerCards.map((card) => card.participantId));
  const rows = allocateVoteShares(cards, winnerIdSet, rng);
  const total = rows.reduce((sum, row) => sum + row.percent, 0);

  return `
    <div class="vote-result-board election-board ${isProcess ? "vote-counting-board" : ""}" aria-hidden="true">
      <div class="election-board-header">
        <span>${isProcess ? "COUNTING LIVE" : "COUNTED 100%"}</span>
        <strong ${isProcess ? `data-vote-total="${total}"` : ""}>TOTAL ${isProcess ? 0 : total}%</strong>
      </div>
      <div class="vote-result-list">
        ${rows
          .map(
            (row, index) => `
              <div class="vote-result-row ${winnerIdSet.has(row.card.participantId) ? "winner" : ""}">
                <span>${index + 1}. ${escapeHtml(row.card.name)}</span>
                <strong style="--vote-width: ${isProcess ? 0 : row.percent}%" ${isProcess ? `data-final-percent="${row.percent}"` : ""}>${isProcess ? 0 : row.percent}%</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function createVoteProcessMarkup(plan: VoteShowPlan): string {
  return `
    <div class="vote-result-board election-board vote-counting-board" aria-hidden="true">
      <div class="election-board-header">
        <span>COUNTING LIVE</span>
        <strong data-vote-total="${plan.totalPercent}">TOTAL 0%</strong>
      </div>
      <div class="vote-result-list">
        ${plan.rows
          .map(
            (row) => `
              <div class="vote-result-row ${row.isWinner ? "winner" : ""}">
                <span>${row.rank}. ${escapeHtml(row.name)}</span>
                <strong style="--vote-width: 0%" data-final-percent="${row.percent}">0%</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function allocateVoteShares(
  cards: BroadcastCard[],
  winnerIdSet: Set<string>,
  rng: () => number,
): Array<{ card: BroadcastCard; percent: number }> {
  if (cards.length === 0) {
    return [];
  }

  const weighted = cards.map((card) => ({
    card,
    weight: winnerIdSet.has(card.participantId)
      ? randomInt(rng, 34, 56)
      : randomInt(rng, 8, 28),
  }));
  const weightTotal = weighted.reduce((sum, row) => sum + row.weight, 0);
  let remaining = 100;
  const rows = weighted.map((row, index) => {
    const isLast = index === weighted.length - 1;
    const percent = isLast
      ? remaining
      : Math.max(1, Math.round((row.weight / weightTotal) * 100));
    remaining -= percent;
    return { card: row.card, percent };
  });

  while (remaining !== 0) {
    const target = rows.find((row) => row.percent + Math.sign(remaining) > 0) ?? rows[0];
    target.percent += Math.sign(remaining);
    remaining -= Math.sign(remaining);
  }

  return rows.sort((left, right) => right.percent - left.percent);
}

function createRaceResultMarkup(
  winnerCards: BroadcastCard[],
  cards: BroadcastCard[],
  rng: () => number,
): string {
  const winnerIdSet = new Set(winnerCards.map((card) => card.participantId));
  const lanes = shuffleCards(cards, rng);

  if (lanes.length === 0) {
    return "";
  }

  return `
    <div class="race-result-board" aria-hidden="true">
      <div class="race-final-banner">
        <span>PHOTO FINISH</span>
        <strong>${winnerCards.length} WINNER${winnerCards.length > 1 ? "S" : ""}</strong>
      </div>
      <div class="race-result-track" style="--race-lanes: ${lanes.length}">
        ${lanes
          .map((card, index) => {
            const isWinner = winnerIdSet.has(card.participantId);
            const finish = isWinner ? randomInt(rng, 82, 91) : randomInt(rng, 34, 76);
            const duration = randomInt(rng, 1350, 2300);
            const delay = randomInt(rng, 0, 420);
            const label = isWinner ? "W" : String(index + 1);

            return `
              <span
                class="race-result-runner ${isWinner ? "winner" : "challenger"}"
                style="--race-top: ${index}; --race-to: ${finish}%; --race-duration: ${duration}ms; --race-delay: ${delay}ms"
                title="${escapeHtml(card.name)}"
              >
                <span>${escapeHtml(label)}</span>
                <em>${escapeHtml(card.name)}</em>
              </span>
            `;
          })
          .join("")}
        <strong>FINISH</strong>
      </div>
    </div>
  `;
}

function createRaceProcessMarkup(plan: RaceShowPlan): string {
  return `
    <div class="race-result-board process-race-board" aria-hidden="true">
      <div class="race-final-banner">
        <span>LIVE RACE</span>
        <strong>LEAD CHANGES</strong>
      </div>
      <div class="race-result-track" style="--race-lanes: ${plan.lanes.length}">
        ${plan.lanes
          .map((lane, index) => {
            const keyframes = lane.keyframes;
            const start = keyframes[0]?.positionPercent ?? 4;
            const early = keyframes[1]?.positionPercent ?? 58;
            const middle = keyframes[2]?.positionPercent ?? 36;
            const late = keyframes[3]?.positionPercent ?? 76;
            const finish = keyframes.at(-1)?.positionPercent ?? 82;

            return `
              <span
                class="race-result-runner ${lane.isWinner ? "winner" : "challenger"} process-runner"
                style="--race-top: ${index}; --race-start: ${start}%; --race-early: ${early}%; --race-middle: ${middle}%; --race-late: ${late}%; --race-to: ${finish}%; --race-duration: ${plan.durationMs}ms; --race-delay: 0ms"
                title="${escapeHtml(lane.name)}"
              >
                <span>${lane.isWinner ? "W" : String(index + 1)}</span>
                <em>${escapeHtml(lane.name)}</em>
              </span>
            `;
          })
          .join("")}
        <strong>FINISH</strong>
      </div>
    </div>
  `;
}

function createRpsResultMarkup(
  winnerCards: BroadcastCard[],
  cards: BroadcastCard[],
  rng: () => number,
): string {
  const winnerIdSet = new Set(winnerCards.map((card) => card.participantId));
  const hands = ["R", "P", "S"];
  const bracket = shuffleCards(cards, rng);
  const matches = [];

  for (let index = 0; index < bracket.length; index += 2) {
    const left = bracket[index];
    const right = bracket[index + 1];
    const leftHand = hands[randomInt(rng, 0, hands.length - 1)];
    const rightHand = hands[randomInt(rng, 0, hands.length - 1)];
    const winner = right
      ? winnerIdSet.has(left.participantId)
        ? left
        : winnerIdSet.has(right.participantId)
          ? right
          : rng() > 0.5
            ? left
            : right
      : left;

    matches.push({ left, right, leftHand, rightHand, winner });
  }

  return `
    <div class="rps-result-board rps-bracket-board" aria-hidden="true">
      <div class="election-board-header">
        <span>TOURNAMENT</span>
        <strong>FINAL ${winnerCards.length}</strong>
      </div>
      <div class="rps-match-list">
        ${matches
          .map(
            (match, index) => `
              <div class="rps-match">
                <span class="rps-player ${match.winner.participantId === match.left.participantId ? "winner" : ""}">
                  ${escapeHtml(match.left.name)} <b class="rps-hand-token" data-final-hand="${match.leftHand}">${match.leftHand}</b>
                </span>
                <em>VS</em>
                <span class="rps-player ${match.right && match.winner.participantId === match.right.participantId ? "winner" : ""}">
                  ${match.right ? escapeHtml(match.right.name) : "BYE"} <b class="rps-hand-token" data-final-hand="${match.right ? match.rightHand : "-"}">${match.right ? match.rightHand : "-"}</b>
                </span>
                <strong>R${index + 1}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function createRpsProcessMarkup(plan: RpsShowPlan): string {
  return `
    <div class="rps-result-board rps-bracket-board" aria-hidden="true">
      <div class="election-board-header">
        <span>TOURNAMENT</span>
        <strong>${plan.rounds} ROUND${plan.rounds === 1 ? "" : "S"}</strong>
      </div>
      <div class="rps-match-list">
        ${plan.matches
          .map(
            (match) => `
              <div class="rps-match">
                <span class="rps-player ${match.winnerParticipantId === match.left.participantId ? "winner" : ""}">
                  ${escapeHtml(match.left.name)} <b class="rps-hand-token" data-final-hand="${match.left.hand}">${match.left.hand}</b>
                </span>
                <em>VS</em>
                <span class="rps-player ${match.right && match.winnerParticipantId === match.right.participantId ? "winner" : ""}">
                  ${match.right ? escapeHtml(match.right.name) : "BYE"} <b class="rps-hand-token" data-final-hand="${match.right ? match.right.hand : "-"}">${match.right ? match.right.hand : "-"}</b>
                </span>
                <strong>R${match.round}-${match.match}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function createDiceResultMarkup(
  winnerCards: BroadcastCard[],
  cards: BroadcastCard[],
  rng: () => number,
  isProcess = false,
): string {
  const winnerIdSet = new Set(winnerCards.map((card) => card.participantId));
  const rolls = shuffleCards(cards, rng)
    .map((card) => {
      const dice = [randomInt(rng, 1, 6), randomInt(rng, 1, 6), randomInt(rng, 1, 6)];
      const bonus = winnerIdSet.has(card.participantId) ? randomInt(rng, 4, 9) : 0;
      return { card, dice, total: dice.reduce((sum, value) => sum + value, 0) + bonus };
    })
    .sort((left, right) => right.total - left.total);

  return `
    <div class="dice-result-board dice-score-board ${isProcess ? "dice-process-board" : ""}" aria-hidden="true">
      ${rolls
        .map(
          (roll, index) => `
            <div class="dice-score-row ${!isProcess && winnerIdSet.has(roll.card.participantId) ? "winner" : ""}" ${isProcess && winnerIdSet.has(roll.card.participantId) ? "data-winner-row=\"true\"" : ""}>
              <span>${index + 1}. ${escapeHtml(roll.card.name)}</span>
              <strong>${roll.dice.map((value, turnIndex) => `<i class="${isProcess ? "pending" : ""}" data-turn="${turnIndex}" data-value="${value}">${isProcess ? "?" : value}</i>`).join("")}</strong>
              <em data-total="${roll.total}">${isProcess ? 0 : roll.total}</em>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function createDiceProcessMarkup(plan: DiceShowPlan): string {
  return `
    <div class="dice-result-board dice-score-board dice-process-board" aria-hidden="true">
      ${plan.rolls
        .map(
          (roll) => `
            <div class="dice-score-row" ${roll.isWinner ? "data-winner-row=\"true\"" : ""}>
              <span>${roll.rank}. ${escapeHtml(roll.name)}</span>
              <strong>${roll.turns.map((value, turnIndex) => `<i class="pending" data-turn="${turnIndex}" data-value="${value}">?</i>`).join("")}</strong>
              <em data-total="${roll.total}">0</em>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function createRollingProcessMarkup(
  plan: RollingShowPlan,
  cards: BroadcastCard[],
): string {
  const cardByParticipantId = new Map(
    cards.map((card) => [card.participantId, card]),
  );

  return `
    <div class="rolling-picker-board" aria-hidden="true">
      <div class="rolling-window">
        <div class="rolling-marker"></div>
        <div class="rolling-strip" style="--rolling-count: ${plan.items.length}; --rolling-lock-index: ${plan.lockIndex}">
          ${plan.items
            .map((item) => {
              const card = cardByParticipantId.get(item.participantId);
              const imagePath = card?.imagePath ?? "";
              const meta = card?.department ?? card?.appliedAsset ?? "ENTRY";

              return `
                <span class="rolling-card ${item.isWinner ? "winner-candidate" : ""}">
                  ${imagePath ? `<img src="/${escapeHtml(imagePath)}" alt="" onerror="this.remove()" />` : ""}
                  <strong>${escapeHtml(item.name)}</strong>
                  <em>${escapeHtml(meta)}</em>
                </span>
              `;
            })
            .join("")}
        </div>
      </div>
      <div class="rolling-status">
        <span>FAST ROLL</span>
        <span>SLOW DOWN</span>
        <strong>LOCK</strong>
      </div>
    </div>
  `;
}

function createRollingResultMarkup(
  winnerCards: BroadcastCard[],
  cards: BroadcastCard[],
  rng: () => number,
): string {
  const winnerIdSet = new Set(winnerCards.map((card) => card.participantId));
  const ordered = [
    ...winnerCards,
    ...shuffleCards(cards, rng).filter((card) => !winnerIdSet.has(card.participantId)),
  ].slice(0, Math.max(3, Math.min(cards.length, 8)));

  return `
    <div class="rolling-result-board" aria-hidden="true">
      ${ordered
        .map(
          (card) => `
            <span class="rolling-result-card ${winnerIdSet.has(card.participantId) ? "winner" : ""}">
              ${escapeHtml(card.name)}
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function createLadderResultMarkup(
  winnerCards: BroadcastCard[],
  cards: BroadcastCard[],
  rng: () => number,
): string {
  const columns = cards.length;
  const winnerIdSet = new Set(winnerCards.map((card) => card.participantId));
  const nameRow = cards
    .map((card) => `<span>${escapeHtml(card.name)}</span>`)
    .join("");
  const rails = cards
    .map(
      (_, index) =>
        `<span class="ladder-rail" style="--col: ${index}"></span>`,
    )
    .join("");
  const steps = Array.from({ length: Math.max(columns + 2, 4) }, (_, index) => {
    const leftColumn = randomInt(rng, 0, Math.max(columns - 2, 0));
    const top = 20 + index * 22;
    return { leftColumn, top };
  });
  const rungs = steps
    .map(
      (step, index) =>
        `<span class="ladder-rung" style="--left-col: ${step.leftColumn}; --rung-top: ${step.top}px; animation-delay: ${index * 0.08}s"></span>`,
    )
    .join("");
  const resultRow = cards
    .map((card) => {
      const isWinner = winnerIdSet.has(card.participantId);
      return `<span class="${isWinner ? "winner" : ""}">${isWinner ? "WIN" : "-"}</span>`;
    })
    .join("");
  const height = Math.max(136, 54 + steps.length * 22);

  return `
    <div class="ladder-result-board real-ladder-board" style="--ladder-columns: ${columns}; --ladder-height: ${height}px" aria-hidden="true">
      <div class="ladder-name-row">
        ${nameRow}
      </div>
      <div class="ladder-grid">
        ${rails}
        ${rungs}
      </div>
      <div class="ladder-result-row">
        ${resultRow}
      </div>
    </div>
  `;
}

function createRevealRng(
  winnerCards: BroadcastCard[],
  cards: BroadcastCard[],
): () => number {
  const seed = [
    Date.now(),
    randomIntFromCrypto(),
    ...winnerCards.map((card) => card.participantId),
    cards.length,
  ].join("|");
  let state = hashString(seed);

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function randomIntFromCrypto(): number {
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues(values);
  return values[0] ?? Math.floor(Math.random() * 0xffffffff);
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffleCards<T>(cards: T[], rng: () => number): T[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, 0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function createWinnerMarkup(card: {
  name: string;
  department?: string;
  appliedAsset?: string;
  imagePath: string;
}): string {
  const meta = [card.department, card.appliedAsset].filter(Boolean).join(" · ");
  const initial = card.name.slice(0, 1);

  return `
    <article class="winner-card">
      <img class="winner-avatar" src="/${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.name)}" onerror="this.replaceWith(Object.assign(document.createElement('div'), { className: 'winner-avatar', textContent: '${escapeHtml(initial)}' }))" />
      <div class="winner-name">${escapeHtml(card.name)}</div>
      <div class="winner-meta">${escapeHtml(meta)}</div>
    </article>
  `;
}

function startProcessAnimation(mode: BroadcastPresentationMode): void {
  if (mode === "vote-count") {
    startVoteCountAnimation();
    return;
  }

  if (mode === "dice-roll") {
    startDiceTurnAnimation();
    return;
  }

  if (mode === "rock-paper-scissors") {
    startRpsRouletteAnimation();
  }
}

function startVoteCountAnimation(): void {
  const board = preview.querySelector(".vote-counting-board");

  if (!board) {
    return;
  }

  const bars = Array.from(
    board.querySelectorAll<HTMLElement>(".vote-result-row strong"),
  ).map((element) => ({
    element,
    current: 0,
    final: Number(element.dataset.finalPercent ?? 0),
  }));
  const totalElement = board.querySelector<HTMLElement>("[data-vote-total]");

  const interval = window.setInterval(() => {
    let total = 0;
    let isComplete = true;

    bars.forEach((bar) => {
      if (bar.current < bar.final) {
        bar.current += 1;
      }

      if (bar.current < bar.final) {
        isComplete = false;
      }

      total += bar.current;
      bar.element.style.setProperty("--vote-width", `${bar.current}%`);
      bar.element.textContent = `${bar.current}%`;
    });

    if (totalElement) {
      totalElement.textContent = `TOTAL ${total}%`;
    }

    if (isComplete) {
      window.clearInterval(interval);
    }
  }, 80);
}

function startDiceTurnAnimation(): void {
  const board = preview.querySelector(".dice-process-board");

  if (!board) {
    return;
  }

  const rows = Array.from(board.querySelectorAll<HTMLElement>(".dice-score-row"));

  [0, 1, 2].forEach((turnIndex) => {
    window.setTimeout(() => {
      rows.forEach((row) => {
        const die = row.querySelector<HTMLElement>(`i[data-turn="${turnIndex}"]`);

        if (!die) {
          return;
        }

        die.classList.add("rolling");
        window.setTimeout(() => {
          die.textContent = die.dataset.value ?? "?";
          die.classList.remove("pending", "rolling");
          updateDiceProcessTotal(row);

          if (turnIndex === 2 && row.dataset.winnerRow === "true") {
            row.classList.add("winner");
          }
        }, 580);
      });
    }, 900 + turnIndex * 2300);
  });
}

function updateDiceProcessTotal(row: HTMLElement): void {
  const totalElement = row.querySelector<HTMLElement>("em[data-total]");

  if (!totalElement) {
    return;
  }

  const revealedTotal = Array.from(row.querySelectorAll<HTMLElement>("i:not(.pending)"))
    .reduce((sum, die) => sum + Number(die.dataset.value ?? 0), 0);
  totalElement.textContent = String(revealedTotal);
}

function startRpsRouletteAnimation(): void {
  const matches = Array.from(preview.querySelectorAll<HTMLElement>(".rps-match"));
  const hands = ["R", "P", "S"];

  matches.forEach((match, matchIndex) => {
    const tokens = Array.from(match.querySelectorAll<HTMLElement>(".rps-hand-token"));
    const startDelay = 650 + matchIndex * 1150;

    window.setTimeout(() => {
      const interval = window.setInterval(() => {
        tokens.forEach((token) => {
          token.textContent = hands[randomIntFromCrypto() % hands.length];
        });
      }, 90);

      window.setTimeout(() => {
        window.clearInterval(interval);
        tokens.forEach((token) => {
          token.textContent = token.dataset.finalHand ?? "-";
          token.classList.add("stopped");
        });
        match.classList.add("resolved");
      }, 820);
    }, startDelay);
  });
}

function formatPresentationMode(mode: BroadcastPresentationMode): string {
  switch (mode) {
    case "random":
      return "Random";
    case "dice-roll":
      return "Dice roll";
    case "rock-paper-scissors":
      return "Rock paper scissors";
    case "vote-count":
      return "Vote count";
    case "running-race":
      return "Running race";
    case "rolling-picker":
      return "Rolling picker";
    case "ladder-game":
      return "Ladder game";
  }
}

function createSuspenseTitle(mode: BroadcastPresentationMode): string {
  switch (mode) {
    case "rock-paper-scissors":
      return "가위바위보 대결 중";
    case "vote-count":
      return "득표 집계 중";
    case "running-race":
      return "레이스 진행 중";
    case "rolling-picker":
      return "롤링 추첨 진행 중";
    case "ladder-game":
      return "사다리 경로 추적 중";
    case "random":
    case "dice-roll":
      return "추첨 주사위 굴리는 중";
  }
}

function createCandidateMarkup(card: {
  name: string;
  department?: string;
  appliedAsset?: string;
  imagePath: string;
  isWinner: boolean;
}): string {
  const meta = [card.department, card.appliedAsset].filter(Boolean).join(" · ");
  const initial = card.name.slice(0, 1);

  return `
    <article class="candidate ${card.isWinner ? "winner" : ""}">
      <img class="avatar" src="/${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.name)}" onerror="this.replaceWith(Object.assign(document.createElement('div'), { className: 'avatar', textContent: '${escapeHtml(initial)}' }))" />
      <div>
        <div class="name">${escapeHtml(card.name)}</div>
        <div class="meta">${escapeHtml(meta)}</div>
      </div>
      <div class="bar"><span></span></div>
    </article>
  `;
}

function createNumberCell(index: number): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "number";
  cell.textContent = String(index + 1);
  return cell;
}

function createInput(
  index: number,
  field: keyof ManualParticipantInput,
  value: string,
): HTMLInputElement {
  const input = document.createElement("input");
  input.value = value;
  input.addEventListener("input", () => {
    inputs = updateManualInputRow(inputs, index, {
      [field]: input.value,
    });
  });
  return input;
}

function createDeleteButton(index: number): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "icon";
  button.type = "button";
  button.textContent = "X";
  button.title = "참가자 삭제";
  button.addEventListener("click", () => {
    if (inputs.length <= 1) {
      setError("참가자는 최소 1명 이상 필요합니다.");
      return;
    }

    inputs = removeManualInputRow(inputs, index);
    render();
  });
  return button;
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }

  return element;
}

function setError(message: string): void {
  errorMessage.textContent = message;
}

function setBusy(isBusy: boolean): void {
  runPreviewButton.disabled = isBusy;
  runPreviewButton.textContent = isBusy ? "추첨 실행 중..." : "추첨 실행";
}


function setApiStatus(status: "checking" | "ready" | "error", message: string): void {
  apiStatus.className = `status ${status === "checking" ? "" : status}`;
  apiStatus.innerHTML = `
    <span class="status-dot"></span>
    <span><strong>API 상태</strong> ${escapeHtml(message)}</span>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
