import type {
  ManualParticipantInput,
  Participant,
  ParticipantInputSource,
  RosterRow,
} from "../../shared/src/index.js";

export type ParticipantInputValidationError = {
  index: number;
  field: "name" | "email" | "id";
  message: string;
};

export type NormalizeParticipantsResult = {
  participants: Participant[];
  errors: ParticipantInputValidationError[];
};

export type NormalizeParticipantsOptions = {
  importedAt: string;
};

export type ParseRosterTextOptions = {
  delimiter?: "\t" | ",";
};

const rosterColumnAliases = {
  name: ["name", "이름"],
  email: ["email", "이메일"],
  department: ["department", "dept", "부서"],
  appliedAsset: ["appliedasset", "asset", "응모자산"],
  submittedAt: ["submittedat", "timestamp", "입력시간"],
} as const;

export function createEmptyManualInput(): ManualParticipantInput {
  return {
    name: "",
  };
}

export function addManualInputRow(
  inputs: ManualParticipantInput[],
): ManualParticipantInput[] {
  return [...inputs, createEmptyManualInput()];
}

export function updateManualInputRow(
  inputs: ManualParticipantInput[],
  index: number,
  patch: Partial<ManualParticipantInput>,
): ManualParticipantInput[] {
  validateManualInputIndex(inputs, index);

  return inputs.map((input, currentIndex) =>
    currentIndex === index ? { ...input, ...patch } : input,
  );
}

export function removeManualInputRow(
  inputs: ManualParticipantInput[],
  index: number,
): ManualParticipantInput[] {
  validateManualInputIndex(inputs, index);

  return inputs.filter((_, currentIndex) => currentIndex !== index);
}

export function normalizeRosterRows(
  rows: RosterRow[],
  options: NormalizeParticipantsOptions,
): NormalizeParticipantsResult {
  return normalizeParticipantInputs(rows, "excel", options);
}

export function parseRosterText(
  text: string,
  options: ParseRosterTextOptions = {},
): RosterRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = options.delimiter ?? detectDelimiter(lines[0]);
  return parseRosterTable(
    lines.map((line) => splitDelimitedLine(line, delimiter)),
  );
}

export function parseRosterTable(table: string[][]): RosterRow[] {
  const rows = table
    .map((row) => row.map((value) => value.trim()))
    .filter((row) => row.some(Boolean));

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const indexes = createRosterColumnIndexes(headers);

  return rows.slice(1).map((row) => {
    return {
      name: getColumn(row, indexes.name) ?? "",
      ...(getColumn(row, indexes.email)
        ? { email: getColumn(row, indexes.email) }
        : {}),
      ...(getColumn(row, indexes.department)
        ? { department: getColumn(row, indexes.department) }
        : {}),
      ...(getColumn(row, indexes.appliedAsset)
        ? { appliedAsset: getColumn(row, indexes.appliedAsset) }
        : {}),
      ...(getColumn(row, indexes.submittedAt)
        ? { submittedAt: getColumn(row, indexes.submittedAt) }
        : {}),
    };
  });
}

export function normalizeManualInputs(
  inputs: ManualParticipantInput[],
  options: NormalizeParticipantsOptions,
): NormalizeParticipantsResult {
  return normalizeParticipantInputs(inputs, "manual", options);
}

function normalizeParticipantInputs(
  inputs: Array<RosterRow | ManualParticipantInput>,
  inputSource: ParticipantInputSource,
  options: NormalizeParticipantsOptions,
): NormalizeParticipantsResult {
  const participants: Participant[] = [];
  const errors: ParticipantInputValidationError[] = [];
  const seenEmails = new Set<string>();
  const seenParticipantIds = new Set<string>();

  inputs.forEach((input, index) => {
    const name = normalizeOptionalText(input.name);

    if (!name) {
      errors.push({
        index,
        field: "name",
        message: "Participant name is required.",
      });
      return;
    }

    const email = normalizeEmail(input.email);
    const department = normalizeOptionalText(input.department);
    const appliedAsset = normalizeOptionalText(input.appliedAsset);
    const submittedAt =
      "submittedAt" in input
        ? normalizeOptionalText(input.submittedAt) ?? options.importedAt
        : options.importedAt;
    const id = createParticipantId({ name, email, department, index });

    if (email && seenEmails.has(email)) {
      errors.push({
        index,
        field: "email",
        message: `Duplicate participant email: ${email}`,
      });
      return;
    }

    if (seenParticipantIds.has(id)) {
      errors.push({
        index,
        field: "id",
        message: `Duplicate participant id: ${id}`,
      });
      return;
    }

    participants.push({
      id,
      inputSource,
      name,
      ...(email ? { email } : {}),
      ...(department ? { department } : {}),
      ...(appliedAsset ? { appliedAsset } : {}),
      submittedAt,
    });

    if (email) {
      seenEmails.add(email);
    }

    seenParticipantIds.add(id);
  });

  return { participants, errors };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function normalizeEmail(value: string | undefined): string | undefined {
  return normalizeOptionalText(value)?.toLowerCase();
}

function detectDelimiter(headerLine: string): "\t" | "," {
  return headerLine.includes("\t") ? "\t" : ",";
}

function splitDelimitedLine(line: string, delimiter: "\t" | ","): string[] {
  return line.split(delimiter).map((value) => value.trim());
}

function createRosterColumnIndexes(headers: string[]): {
  name: number;
  email?: number;
  department?: number;
  appliedAsset?: number;
  submittedAt?: number;
} {
  return {
    name: findColumnIndex(headers, rosterColumnAliases.name) ?? 0,
    email: findColumnIndex(headers, rosterColumnAliases.email),
    department: findColumnIndex(headers, rosterColumnAliases.department),
    appliedAsset: findColumnIndex(headers, rosterColumnAliases.appliedAsset),
    submittedAt: findColumnIndex(headers, rosterColumnAliases.submittedAt),
  };
}

function findColumnIndex(
  headers: string[],
  aliases: readonly string[],
): number | undefined {
  const index = headers.findIndex((header) => aliases.includes(header));
  return index >= 0 ? index : undefined;
}

function getColumn(
  columns: string[],
  index: number | undefined,
): string | undefined {
  if (index === undefined) {
    return undefined;
  }

  return normalizeOptionalText(columns[index]);
}

function normalizeHeader(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function validateManualInputIndex(
  inputs: ManualParticipantInput[],
  index: number,
): void {
  if (!Number.isInteger(index) || index < 0 || index >= inputs.length) {
    throw new Error(`Manual input row index is out of range: ${index}`);
  }
}

function createParticipantId(input: {
  name: string;
  email?: string;
  department?: string;
  index: number;
}): string {
  if (input.email) {
    return `email:${slugify(input.email)}`;
  }

  const identity = [input.name, input.department, String(input.index + 1)]
    .filter(Boolean)
    .join(":");

  return `participant:${slugify(identity)}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
