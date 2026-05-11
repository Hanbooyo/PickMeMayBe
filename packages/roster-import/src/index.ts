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

export function normalizeRosterRows(
  rows: RosterRow[],
  options: NormalizeParticipantsOptions,
): NormalizeParticipantsResult {
  return normalizeParticipantInputs(rows, "excel", options);
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
