import { randomInt } from "node:crypto";

import type {
  Participant,
  RaffleOptions,
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
  randomInt?: RaffleRandomInt;
};

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
    input.randomInt ?? cryptoRandomInt,
  );
  const winners = shuffled.slice(0, input.options.winnerCount);

  return {
    id: input.id,
    winnerIds: winners.map((winner) => winner.id),
    candidateIds: eligibleParticipants.map((participant) => participant.id),
    options: input.options,
    createdAt: input.createdAt,
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

function cryptoRandomInt(maxExclusive: number): number {
  return randomInt(maxExclusive);
}
