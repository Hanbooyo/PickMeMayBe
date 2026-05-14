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

const importedAt = new Date().toISOString();
const manualPreviewEndpoint = "http://localhost:4317/api/manual-preview";
const historyEndpoint = "http://localhost:4317/api/history";
const parseRosterFileEndpoint = "http://localhost:4317/api/parse-roster-file";
const faceResourcesEndpoint = "http://localhost:4317/api/resources/faces";
const defaultRevealDurationMs = 4000;
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
const revealDurationInput = getElement("reveal-duration") as HTMLSelectElement;
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
    const revealDurationMs = readRevealDurationMs();
    const suspenseStartedAt = Date.now();
    renderSuspensePreview(
      presentationMode,
      normalized.participants.length,
      revealDurationMs,
    );
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

    await delay(Math.max(0, revealDurationMs - (Date.now() - suspenseStartedAt)));
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

function readRevealDurationMs(): number {
  const durationMs = Number(revealDurationInput.value);

  if ([3000, 4000, 5000].includes(durationMs)) {
    return durationMs;
  }

  return defaultRevealDurationMs;
}

type BroadcastPresentationMode =
  | "random"
  | "dice-roll"
  | "rock-paper-scissors"
  | "vote-count"
  | "running-race"
  | "ladder-game";

function readPresentationMode(): BroadcastPresentationMode {
  const modes = new Set<BroadcastPresentationMode>([
    "random",
    "dice-roll",
    "rock-paper-scissors",
    "vote-count",
    "running-race",
    "ladder-game",
  ]);

  if (modes.has(presentationModeInput.value as BroadcastPresentationMode)) {
    return presentationModeInput.value as BroadcastPresentationMode;
  }

  return "random";
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
      ${createModeResultMarkup(revealMode, winnerCards.length)}
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
  const isRaceMode = presentationMode === "running-race";
  const modeLabel = formatPresentationMode(presentationMode);
  const visual = createSuspenseVisual(presentationMode, participantCount);
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
): string {
  switch (presentationMode) {
    case "running-race":
      return `
        <div class="race-suspense" aria-hidden="true">
          ${Array.from({ length: Math.min(3, Math.max(1, participantCount)) })
            .map(
              () => `
                <div class="race-suspense-lane">
                  <span class="race-suspense-runner"></span>
                </div>
              `,
            )
            .join("")}
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
    case "ladder-game":
      return `<div class="reveal-accent">사다리 도착</div>`;
    case "random":
    case "dice-roll":
      return `<div class="reveal-accent">주사위 결과 확정</div>`;
  }
}

function createModeResultMarkup(
  mode: BroadcastPresentationMode,
  winnerCount: number,
): string {
  switch (mode) {
    case "vote-count":
      return `
        <div class="vote-result-board" aria-hidden="true">
          <div class="vote-result-row">
            <span>초반 집계</span>
            <strong style="--vote-width: 48%">48%</strong>
          </div>
          <div class="vote-result-row">
            <span>개표 진행</span>
            <strong style="--vote-width: 73%">73%</strong>
          </div>
          <div class="vote-result-row winner">
            <span>최종 확정</span>
            <strong style="--vote-width: 100%">${winnerCount}명</strong>
          </div>
        </div>
      `;
    case "running-race":
      return `
        <div class="race-result-board" aria-hidden="true">
          <div class="race-result-track">
            <span class="race-result-runner third">3</span>
            <span class="race-result-runner second">2</span>
            <span class="race-result-runner first">1</span>
            <strong>FINISH</strong>
          </div>
        </div>
      `;
    case "ladder-game":
      return `
        <div class="ladder-result-board" aria-hidden="true">
          <div class="ladder-result-path">
            <span class="ladder-vertical left"></span>
            <span class="ladder-vertical center"></span>
            <span class="ladder-vertical right"></span>
            <span class="ladder-step one"></span>
            <span class="ladder-step two"></span>
            <span class="ladder-step three"></span>
            <strong>도착</strong>
          </div>
        </div>
      `;
    case "rock-paper-scissors":
      return `
        <div class="rps-result-board" aria-hidden="true">
          <div class="rps-bracket">
            <span class="rps-token left">✊</span>
            <span class="rps-versus">VS</span>
            <span class="rps-token right">✌</span>
          </div>
          <div class="rps-winner-line">
            <span>✋</span>
            <strong>WIN</strong>
          </div>
        </div>
      `;
    case "random":
    case "dice-roll":
      return `
        <div class="dice-result-board" aria-hidden="true">
          <span class="dice-result small">2</span>
          <span class="dice-result main">6</span>
          <span class="dice-result small">4</span>
        </div>
      `;
  }
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
