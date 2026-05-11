import {
  addManualInputRow,
  createEmptyManualInput,
  normalizeManualInputs,
  removeManualInputRow,
  updateManualInputRow,
} from "../../../packages/roster-import/src/index.js";

import type { ManualParticipantInput } from "../../../packages/shared/src/index.js";

const importedAt = new Date().toISOString();
const manualPreviewEndpoint = "http://localhost:4317/api/manual-preview";
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

const table = getElement("participant-table");
const preview = getElement("preview");
const errorMessage = getElement("error-message");

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

render();
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
  try {
    const normalized = normalizeManualInputs(inputs, { importedAt });

    if (normalized.errors.length > 0) {
      setError(
        normalized.errors
          .map((error) => `${error.index + 1}행: ${error.message}`)
          .join(" / "),
      );
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
        winnerCount: 1,
      }),
    });

    const payload = (await response.json()) as ManualPreviewApiResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "API preview request failed.");
    }

    renderPreview(payload.scenario.cards, payload.scenario.winnerIds);
  } catch (error) {
    setError(
      error instanceof Error
        ? `${error.message} API 서버가 실행 중인지 확인하세요: npm.cmd run demo:api`
        : "Unknown preview error.",
    );
  }
}

type ManualPreviewApiResponse = {
  error?: string;
  scenario: {
    winnerIds: string[];
    cards: Array<{
      participantId: string;
      name: string;
      department?: string;
      appliedAsset?: string;
      isWinner: boolean;
    }>;
  };
};

function renderPreview(
  cards: Array<{
    participantId: string;
    name: string;
    department?: string;
    appliedAsset?: string;
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
  isWinner: boolean;
}): string {
  const meta = [card.department, card.appliedAsset].filter(Boolean).join(" · ");
  const initial = card.name.slice(0, 1);

  return `
    <article class="candidate ${card.isWinner ? "winner" : ""}">
      <div class="avatar">${escapeHtml(initial)}</div>
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
