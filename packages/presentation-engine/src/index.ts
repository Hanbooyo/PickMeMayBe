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

export type ElectionBroadcastScenario = PresentationScenario & {
  mode: "election-broadcast";
  title: string;
  aspectRatio: "16:9";
  cards: BroadcastCandidateCard[];
  timeline: BroadcastTimelineEvent[];
};

export type CreateElectionBroadcastScenarioInput = {
  id: string;
  title: string;
  raffleResult: RaffleResult;
  participants: Participant[];
  visualAssets: VisualAsset[];
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

  return {
    id: input.id,
    mode: "election-broadcast",
    raffleResultId: input.raffleResult.id,
    participantIds,
    winnerIds: input.raffleResult.winnerIds,
    durationSeconds,
    title: input.title,
    aspectRatio: "16:9",
    cards: participantIds.map((participantId) => {
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
    }),
    timeline: createDefaultBroadcastTimeline(durationSeconds),
  };
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
