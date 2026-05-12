import type {
  Participant,
  PresentationScenario,
  RaffleResult,
  VisualAsset,
} from "../../shared/src/index.js";

export type BroadcastTimelineEventType =
  | "intro"
  | "candidate-roll"
  | "suspense-pause"
  | "winner-reveal"
  | "celebration";

export type BroadcastTimelineEvent = {
  type: BroadcastTimelineEventType;
  startSecond: number;
  endSecond: number;
};

export type BroadcastCandidateCard = {
  participantId: string;
  name: string;
  department?: string;
  appliedAsset?: string;
  imagePath: string;
  isWinner: boolean;
};

export type BroadcastPresentationMode = "standard" | "running-race";

export type BroadcastRaceLane = {
  participantId: string;
  lane: number;
  finishRank: number;
  startPercent: number;
  midpointPercent: number;
  finishPercent: number;
  isWinner: boolean;
};

export type ElectionBroadcastScenario = PresentationScenario & {
  mode: "election-broadcast";
  presentationMode: BroadcastPresentationMode;
  title: string;
  aspectRatio: "16:9";
  cards: BroadcastCandidateCard[];
  race?: {
    lanes: BroadcastRaceLane[];
    suspenseSecond: number;
    revealSecond: number;
  };
  timeline: BroadcastTimelineEvent[];
};

export type CreateElectionBroadcastScenarioInput = {
  id: string;
  title: string;
  raffleResult: RaffleResult;
  participants: Participant[];
  visualAssets: VisualAsset[];
  presentationMode?: BroadcastPresentationMode;
  durationSeconds?: number;
};

export function createElectionBroadcastScenario(
  input: CreateElectionBroadcastScenarioInput,
): ElectionBroadcastScenario {
  const durationSeconds = input.durationSeconds ?? 10;
  const participantIndex = new Map(
    input.participants.map((participant) => [participant.id, participant]),
  );
  const assetIndex = new Map(
    input.visualAssets.map((asset) => [asset.participantId, asset]),
  );

  const participantIds = input.raffleResult.candidateIds;
  const winnerIdSet = new Set(input.raffleResult.winnerIds);
  const presentationMode = input.presentationMode ?? "standard";
  validateWinnersBelongToCandidates(input.raffleResult);
  const cards = participantIds.map((participantId) => {
    const participant = participantIndex.get(participantId);
    const asset = assetIndex.get(participantId);

    if (!participant) {
      throw new Error(`Missing participant for scenario: ${participantId}`);
    }

    if (!asset) {
      throw new Error(`Missing visual asset for scenario: ${participantId}`);
    }

    return {
      participantId,
      name: participant.name,
      ...(participant.department
        ? { department: participant.department }
        : {}),
      ...(participant.appliedAsset
        ? { appliedAsset: participant.appliedAsset }
        : {}),
      imagePath: asset.imagePath,
      isWinner: winnerIdSet.has(participantId),
    };
  });
  const scenario: ElectionBroadcastScenario = {
    id: input.id,
    mode: "election-broadcast",
    presentationMode,
    raffleResultId: input.raffleResult.id,
    participantIds,
    winnerIds: input.raffleResult.winnerIds,
    durationSeconds,
    title: input.title,
    aspectRatio: "16:9",
    cards,
    timeline: createDefaultBroadcastTimeline(durationSeconds),
  };

  if (presentationMode === "running-race") {
    scenario.race = createBroadcastRace(participantIds, winnerIdSet, durationSeconds);
  }

  return scenario;
}

export function createBroadcastRace(
  participantIds: string[],
  winnerIdSet: Set<string>,
  durationSeconds: number,
): ElectionBroadcastScenario["race"] {
  const winnerIds = participantIds.filter((participantId) =>
    winnerIdSet.has(participantId),
  );
  const nonWinnerIds = participantIds.filter(
    (participantId) => !winnerIdSet.has(participantId),
  );
  const finishOrder = [...winnerIds, ...nonWinnerIds];
  const finishRankIndex = new Map(
    finishOrder.map((participantId, index) => [participantId, index + 1]),
  );

  return {
    lanes: participantIds.map((participantId, index) => {
      const isWinner = winnerIdSet.has(participantId);

      return {
        participantId,
        lane: index + 1,
        finishRank: finishRankIndex.get(participantId) ?? index + 1,
        startPercent: 5 + index * 2,
        midpointPercent: isWinner ? 58 : Math.max(32, 50 - index * 3),
        finishPercent: isWinner ? 100 : Math.max(68, 92 - index * 4),
        isWinner,
      };
    }),
    suspenseSecond: durationSeconds * 0.52,
    revealSecond: durationSeconds * 0.75,
  };
}

function validateWinnersBelongToCandidates(raffleResult: RaffleResult): void {
  const candidateIdSet = new Set(raffleResult.candidateIds);
  const seenWinnerIds = new Set<string>();

  raffleResult.winnerIds.forEach((winnerId) => {
    if (seenWinnerIds.has(winnerId)) {
      throw new Error(`Duplicate winner in scenario: ${winnerId}`);
    }

    if (!candidateIdSet.has(winnerId)) {
      throw new Error(`Winner is not included in candidates: ${winnerId}`);
    }

    seenWinnerIds.add(winnerId);
  });
}

export function createDefaultBroadcastTimeline(
  durationSeconds: number,
): BroadcastTimelineEvent[] {
  if (durationSeconds < 6) {
    throw new Error("Broadcast scenario duration must be at least 6 seconds.");
  }

  return [
    {
      type: "intro",
      startSecond: 0,
      endSecond: 1.5,
    },
    {
      type: "candidate-roll",
      startSecond: 1.5,
      endSecond: durationSeconds * 0.45,
    },
    {
      type: "suspense-pause",
      startSecond: durationSeconds * 0.45,
      endSecond: durationSeconds * 0.52,
    },
    {
      type: "winner-reveal",
      startSecond: durationSeconds * 0.52,
      endSecond: durationSeconds * 0.75,
    },
    {
      type: "celebration",
      startSecond: durationSeconds * 0.75,
      endSecond: durationSeconds,
    },
  ];
}
