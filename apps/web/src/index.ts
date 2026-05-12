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
const rendersEndpoint = "http://localhost:4317/api/renders";
const faceResourcesEndpoint = "http://localhost:4317/api/resources/faces";
const renderLatestJobsEndpoint = "http://localhost:4317/api/render-latest-jobs";
const renderJobsEndpoint = "http://localhost:4317/api/render-jobs";
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
const renderList = getElement("render-list");
const renderJobList = getElement("render-job-list");
const runPreviewButton = getElement("run-preview") as HTMLButtonElement;
const renderLatestButton = getElement("render-latest") as HTMLButtonElement;
const refreshRendersButton = getElement("refresh-renders") as HTMLButtonElement;
const winnerCountInput = getElement("winner-count") as HTMLInputElement;
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

refreshRendersButton.addEventListener("click", async () => {
  await loadRenderArtifacts();
  await loadRenderJobs();
});

renderLatestButton.addEventListener("click", async () => {
  await renderLatestVideo();
});

render();
void checkApiStatus();
void loadHistory();
void loadFaceResources();
void loadRenderArtifacts();
void loadRenderJobs();
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
        allowPreviousWinners: allowPreviousWinnersInput.checked,
        previousWinnerIds: resultHistory.flatMap((entry) => entry.winnerIds),
      }),
    });

    const payload = (await response.json()) as ManualPreviewApiResponse;

    if (!response.ok) {
      throw new Error(formatApiError(payload));
    }

    renderPreview(payload.scenario.cards, payload.scenario.winnerIds);
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

async function loadRenderArtifacts(): Promise<void> {
  refreshRendersButton.disabled = true;

  try {
    const response = await fetch(rendersEndpoint);

    if (!response.ok) {
      throw new Error("Render artifact request failed.");
    }

    const payload = (await response.json()) as {
      renders: RenderArtifactSummary[];
    };
    renderArtifacts(payload.renders);
  } catch {
    renderList.innerHTML = `<div class="empty-state">Render outputs are not available. Start the API server and run npm.cmd run render:sample.</div>`;
  } finally {
    refreshRendersButton.disabled = false;
  }
}

async function renderLatestVideo(): Promise<void> {
  setRenderBusy(true);
  renderList.innerHTML = `<div class="empty-state">Queueing latest raffle render job.</div>`;

  try {
    const response = await fetch(renderLatestJobsEndpoint, {
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Latest render job request failed.");
    }

    const payload = (await response.json()) as {
      job: RenderJob;
    };
    const completed = await waitForRenderJob(payload.job.id);

    if (completed.status === "failed") {
      throw new Error(completed.error ?? "Latest render job failed.");
    }

    renderArtifacts(completed.renders ?? []);
    await loadRenderJobs();
  } catch (error) {
    renderList.innerHTML = `<div class="empty-state">${escapeHtml(
      error instanceof Error
        ? `${error.message} Run a raffle preview first and check that the API server can run npm.cmd run render:sample.`
        : "Latest render failed.",
    )}</div>`;
  } finally {
    setRenderBusy(false);
  }
}

type ManualPreviewApiResponse = {
  error?: string;
  code?: string;
  scenario: ElectionBroadcastScenario;
  history: RaffleHistoryEntry[];
};

type RenderArtifactSummary = {
  fileName: string;
  path: string;
  sizeBytes: number;
  format: "mp4";
};

type FaceResourceSummary = {
  fileName: string;
  key: string;
  path: string;
  format: "svg" | "png" | "jpg" | "jpeg" | "webp";
};

type RenderJob = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  createdAt?: string;
  updatedAt?: string;
  error?: string;
  renders?: RenderArtifactSummary[];
};

async function loadRenderJobs(): Promise<void> {
  try {
    const response = await fetch(renderJobsEndpoint);

    if (!response.ok) {
      throw new Error("Render job history request failed.");
    }

    const payload = (await response.json()) as {
      jobs: RenderJob[];
    };
    renderJobs(payload.jobs);
  } catch {
    renderJobList.innerHTML = `<div class="empty-state">Render job history is not available.</div>`;
  }
}

async function waitForRenderJob(jobId: string): Promise<RenderJob> {
  for (;;) {
    const response = await fetch(`${renderJobsEndpoint}/${encodeURIComponent(jobId)}`);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Render job status request failed.");
    }

    const payload = (await response.json()) as {
      job: RenderJob;
    };

    renderList.innerHTML = `<div class="empty-state">Render job ${escapeHtml(payload.job.status)}...</div>`;

    if (payload.job.status === "done" || payload.job.status === "failed") {
      return payload.job;
    }

    await delay(1200);
  }
}

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

function renderArtifacts(renders: RenderArtifactSummary[]): void {
  if (renders.length === 0) {
    renderList.innerHTML = `<div class="empty-state">No render outputs yet. Run npm.cmd run render:sample.</div>`;
    return;
  }

  renderList.innerHTML = renders
    .map(
      (render) => `
        <article class="render-item">
          <div>
            <div class="render-name">${escapeHtml(render.fileName)}</div>
            <a class="render-download" href="${rendersEndpoint}/${encodeURIComponent(render.fileName)}" download>Download MP4</a>
          </div>
          <div class="render-meta">${escapeHtml(render.format.toUpperCase())} · ${formatBytes(render.sizeBytes)}</div>
        </article>
      `,
    )
    .join("");
}

function renderJobs(jobs: RenderJob[]): void {
  if (jobs.length === 0) {
    renderJobList.innerHTML = `<div class="empty-state">No render jobs yet.</div>`;
    return;
  }

  renderJobList.innerHTML = jobs
    .slice(0, 5)
    .map(
      (job) => `
        <article class="job-item">
          <div class="job-status">${escapeHtml(job.status)}</div>
          <div class="job-id">${escapeHtml(job.id.slice(0, 8))}</div>
          <div class="job-time">${escapeHtml(formatHistoryTime(job.updatedAt ?? job.createdAt ?? ""))}</div>
        </article>
      `,
    )
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

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function renderPreview(
  cards: Array<{
    participantId: string;
    name: string;
    department?: string;
    appliedAsset?: string;
    imagePath: string;
    isWinner: boolean;
  }>,
  winnerIds: string[],
): void {
  const winnerIdSet = new Set(winnerIds);
  const winnerNames = cards
    .filter((card) => winnerIdSet.has(card.participantId))
    .map((card) => card.name)
    .join(", ");

  preview.innerHTML = `
    <header>
      <h2>PickMeMaybe LIVE</h2>
      <div class="badge">LIVE</div>
    </header>
    <div class="preview-body">
      <div class="candidates">
        ${cards.map((card) => createCandidateMarkup(card)).join("")}
      </div>
      <aside class="winner-panel">
        <div class="winner-label">최종 당첨 확정</div>
        <div class="winner-name">${escapeHtml(winnerNames)}</div>
      </aside>
    </div>
    <footer>속보: 수기 입력 기반 추첨 집계 완료</footer>
  `;
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

function setRenderBusy(isBusy: boolean): void {
  renderLatestButton.disabled = isBusy;
  refreshRendersButton.disabled = isBusy;
  renderLatestButton.textContent = isBusy ? "Rendering..." : "Render latest";
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
