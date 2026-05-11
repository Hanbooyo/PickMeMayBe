import type { ElectionBroadcastScenario } from "../../presentation-engine/src/index.js";

export type RaffleHistoryEntry = {
  id: string;
  title: string;
  createdAt: string;
  winnerIds: string[];
  winnerNames: string[];
};

export function createHistoryEntryFromScenario(
  scenario: ElectionBroadcastScenario,
  createdAt: string,
): RaffleHistoryEntry {
  const winnerIdSet = new Set(scenario.winnerIds);
  const winnerNames = scenario.cards
    .filter((card) => winnerIdSet.has(card.participantId))
    .map((card) => card.name);

  return {
    id: scenario.id,
    title: scenario.title,
    createdAt,
    winnerIds: scenario.winnerIds,
    winnerNames,
  };
}

export function addHistoryEntry(
  history: RaffleHistoryEntry[],
  entry: RaffleHistoryEntry,
  limit = 5,
): RaffleHistoryEntry[] {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("History limit must be a positive integer.");
  }

  return [entry, ...history].slice(0, limit);
}
