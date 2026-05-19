import { createHash } from "node:crypto";

import type {
  Participant,
  RaffleOptions,
  RaffleProof,
  RaffleResult,
} from "../../shared/src/index.js";

export type RaffleEngineErrorCode =
  | "NO_PARTICIPANTS"
  | "NO_ELIGIBLE_PARTICIPANTS"
  | "INVALID_WINNER_COUNT"
  | "WINNER_COUNT_EXCEEDS_ELIGIBLE_COUNT"
  | "DUPLICATE_PARTICIPANT_ID";

export class RaffleEngineError extends Error {
  constructor(
    public readonly code: RaffleEngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RaffleEngineError";
  }
}

export type RaffleRandomInt = (maxExclusive: number) => number;

export type DrawWinnersInput = {
  id: string;
  participants: Participant[];
  options: RaffleOptions;
  previousWinnerIds?: string[];
  createdAt: string;
  randomSeed?: string;
  randomInt?: RaffleRandomInt;
};

const raffleAlgorithmVersion = "pick-me-maybe-raffle@1";

export function drawWinners(input: DrawWinnersInput): RaffleResult {
  validateParticipants(input.participants);
  validateWinnerCount(input.options.winnerCount);

  const eligibleParticipants = getEligibleParticipants(
    input.participants,
    input.options,
    input.previousWinnerIds ?? [],
  );

  if (eligibleParticipants.length === 0) {
    throw new RaffleEngineError(
      "NO_ELIGIBLE_PARTICIPANTS",
      "There are no eligible participants.",
    );
  }

  if (input.options.winnerCount > eligibleParticipants.length) {
    throw new RaffleEngineError(
      "WINNER_COUNT_EXCEEDS_ELIGIBLE_COUNT",
      "Winner count exceeds eligible participant count.",
    );
  }

  const shuffled = shuffleParticipants(
    eligibleParticipants,
    getRandomIntSource(input),
  );
  const winners = shuffled.slice(0, input.options.winnerCount);

  const resultCore = {
    id: input.id,
    winnerIds: winners.map((winner) => winner.id),
    candidateIds: eligibleParticipants.map((participant) => participant.id),
    options: input.options,
    createdAt: input.createdAt,
  };

  return {
    ...resultCore,
    proof: createRaffleProof({
      input,
      resultCore,
      eligibleParticipants,
    }),
  };
}

export function getEligibleParticipants(
  participants: Participant[],
  options: RaffleOptions,
  previousWinnerIds: string[],
): Participant[] {
  if (participants.length === 0) {
    throw new RaffleEngineError(
      "NO_PARTICIPANTS",
      "Participant list is empty.",
    );
  }

  if (options.allowPreviousWinners) {
    return [...participants];
  }

  const previousWinnerIdSet = new Set(previousWinnerIds);
  return participants.filter(
    (participant) => !previousWinnerIdSet.has(participant.id),
  );
}

function validateParticipants(participants: Participant[]): void {
  if (participants.length === 0) {
    throw new RaffleEngineError(
      "NO_PARTICIPANTS",
      "Participant list is empty.",
    );
  }

  const ids = new Set<string>();

  participants.forEach((participant) => {
    if (ids.has(participant.id)) {
      throw new RaffleEngineError(
        "DUPLICATE_PARTICIPANT_ID",
        `Duplicate participant id: ${participant.id}`,
      );
    }

    ids.add(participant.id);
  });
}

function validateWinnerCount(winnerCount: number): void {
  if (!Number.isInteger(winnerCount) || winnerCount <= 0) {
    throw new RaffleEngineError(
      "INVALID_WINNER_COUNT",
      "Winner count must be a positive integer.",
    );
  }
}

function shuffleParticipants(
  participants: Participant[],
  randomInteger: RaffleRandomInt,
): Participant[] {
  const shuffled = [...participants];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function createRaffleProof({
  input,
  resultCore,
  eligibleParticipants,
}: {
  input: DrawWinnersInput;
  resultCore: Omit<RaffleResult, "proof">;
  eligibleParticipants: Participant[];
}): RaffleProof {
  return {
    algorithmVersion: raffleAlgorithmVersion,
    randomSource: getRandomSourceLabel(input),
    ...(input.randomSeed ? { randomSeed: input.randomSeed } : {}),
    inputHash: sha256Canonical(
      input.participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        email: participant.email,
        department: participant.department,
        appliedAsset: participant.appliedAsset,
        inputSource: participant.inputSource,
        submittedAt: participant.submittedAt,
      })),
    ),
    settingsHash: sha256Canonical({
      options: input.options,
      previousWinnerIds: input.previousWinnerIds ?? [],
      randomSeed: input.randomSeed,
    }),
    resultHash: sha256Canonical(resultCore),
    candidateCount: eligibleParticipants.length,
    winnerCount: resultCore.winnerIds.length,
  };
}

function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

function getRandomIntSource(input: DrawWinnersInput): RaffleRandomInt {
  if (input.randomInt) {
    return input.randomInt;
  }

  if (input.randomSeed) {
    return createSeededRandomInt(input.randomSeed);
  }

  return cryptoRandomInt;
}

function getRandomSourceLabel(input: DrawWinnersInput): RaffleProof["randomSource"] {
  if (input.randomInt) {
    return "injected";
  }

  if (input.randomSeed) {
    return "seeded";
  }

  return "crypto";
}

function createSeededRandomInt(seed: string): RaffleRandomInt {
  let state = hashSeed(seed);

  return (maxExclusive: number) => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RaffleEngineError(
        "INVALID_WINNER_COUNT",
        "Random integer upper bound must be a positive integer.",
      );
    }

    state = (state * 1664525 + 1013904223) >>> 0;
    return Math.floor((state / 0x100000000) * maxExclusive);
  };
}

function hashSeed(seed: string): number {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0);
}

function cryptoRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RaffleEngineError(
      "INVALID_WINNER_COUNT",
      "Random integer upper bound must be a positive integer.",
    );
  }

  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.getRandomValues) {
    throw new Error("A crypto random source is not available.");
  }

  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const values = new Uint32Array(1);

  do {
    cryptoApi.getRandomValues(values);
  } while (values[0] >= limit);

  return values[0] % maxExclusive;
}
