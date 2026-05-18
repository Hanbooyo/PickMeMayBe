import type {
  BroadcastCandidateCard,
  BroadcastPresentationMode,
  ElectionBroadcastScenario,
} from "../../presentation-engine/src/index.js";

export type ShowProcessPhase =
  | "ready"
  | "start"
  | "shuffle"
  | "chase"
  | "slowdown"
  | "finish"
  | "reveal";

export type ShowProcessStep = {
  phase: ShowProcessPhase;
  startMs: number;
  endMs: number;
  label: string;
};

export type RaceShowLaneKeyframe = {
  atMs: number;
  positionPercent: number;
};

export type RaceShowLane = {
  participantId: string;
  name: string;
  lane: number;
  isWinner: boolean;
  keyframes: RaceShowLaneKeyframe[];
};

export type RaceShowPlan = {
  mode: "running-race";
  durationMs: number;
  steps: ShowProcessStep[];
  lanes: RaceShowLane[];
};

export type RollingShowItem = {
  participantId: string;
  name: string;
  isWinner: boolean;
};

export type RollingShowPlan = {
  mode: "rolling-picker";
  durationMs: number;
  steps: ShowProcessStep[];
  items: RollingShowItem[];
  lockIndex: number;
};

export type DiceShowRoll = {
  participantId: string;
  name: string;
  isWinner: boolean;
  turns: number[];
  total: number;
  rank: number;
};

export type DiceShowPlan = {
  mode: "dice-roll";
  durationMs: number;
  steps: ShowProcessStep[];
  turnCount: number;
  rolls: DiceShowRoll[];
};

export type VoteShowRow = {
  participantId: string;
  name: string;
  isWinner: boolean;
  percent: number;
  rank: number;
};

export type VoteShowPlan = {
  mode: "vote-count";
  durationMs: number;
  steps: ShowProcessStep[];
  totalPercent: number;
  rows: VoteShowRow[];
};

export type GenericShowPlan = {
  mode: Exclude<
    BroadcastPresentationMode,
    "running-race" | "rolling-picker" | "dice-roll" | "vote-count"
  >;
  durationMs: number;
  steps: ShowProcessStep[];
};

export type ShowPlan =
  | RaceShowPlan
  | RollingShowPlan
  | DiceShowPlan
  | VoteShowPlan
  | GenericShowPlan;

export type CreateShowPlanOptions = {
  durationMs?: number;
  seed?: string;
};

const defaultShowDurationMs = 10000;

export function createShowPlan(
  scenario: ElectionBroadcastScenario,
  options: CreateShowPlanOptions = {},
): ShowPlan {
  const durationMs = options.durationMs ?? defaultShowDurationMs;
  const steps = createDefaultShowSteps(durationMs);

  if (scenario.presentationMode === "running-race") {
    return {
      mode: "running-race",
      durationMs,
      steps,
      lanes: createRaceShowLanes(
        scenario.cards,
        new Set(scenario.winnerIds),
        createSeededRng(options.seed ?? scenario.raffleResultId),
        durationMs,
      ),
    };
  }

  if (scenario.presentationMode === "rolling-picker") {
    const items = createRollingShowItems(
      scenario.cards,
      new Set(scenario.winnerIds),
      createSeededRng(options.seed ?? scenario.raffleResultId),
    );

    return {
      mode: "rolling-picker",
      durationMs,
      steps,
      items,
      lockIndex: items.length - 1,
    };
  }

  if (scenario.presentationMode === "dice-roll") {
    return {
      mode: "dice-roll",
      durationMs,
      steps,
      turnCount: 3,
      rolls: createDiceShowRolls(
        scenario.cards,
        new Set(scenario.winnerIds),
        createSeededRng(options.seed ?? scenario.raffleResultId),
      ),
    };
  }

  if (scenario.presentationMode === "vote-count") {
    return {
      mode: "vote-count",
      durationMs,
      steps,
      totalPercent: 100,
      rows: createVoteShowRows(
        scenario.cards,
        new Set(scenario.winnerIds),
        createSeededRng(options.seed ?? scenario.raffleResultId),
      ),
    };
  }

  return {
    mode: scenario.presentationMode,
    durationMs,
    steps,
  };
}

function createRollingShowItems(
  cards: BroadcastCandidateCard[],
  winnerIdSet: Set<string>,
  rng: () => number,
): RollingShowItem[] {
  const winner = cards.find((card) => winnerIdSet.has(card.participantId)) ?? cards[0];
  const shuffled = shuffle(cards, rng);
  const items = Array.from({ length: Math.max(24, cards.length * 5) }, (_, index) => {
    const card = shuffled[index % shuffled.length] ?? winner;

    return {
      participantId: card.participantId,
      name: card.name,
      isWinner: winnerIdSet.has(card.participantId),
    };
  });

  if (winner) {
    items.push({
      participantId: winner.participantId,
      name: winner.name,
      isWinner: true,
    });
  }

  return items;
}

function createDiceShowRolls(
  cards: BroadcastCandidateCard[],
  winnerIdSet: Set<string>,
  rng: () => number,
): DiceShowRoll[] {
  const rolls = shuffle(cards, rng).map((card) => {
    const isWinner = winnerIdSet.has(card.participantId);
    const turns = isWinner
      ? [randomInt(rng, 4, 6), randomInt(rng, 4, 6), randomInt(rng, 4, 6)]
      : [randomInt(rng, 1, 4), randomInt(rng, 1, 4), randomInt(rng, 1, 4)];

    return {
      participantId: card.participantId,
      name: card.name,
      isWinner,
      turns,
      total: turns.reduce((sum, value) => sum + value, 0),
      rank: 0,
    };
  });

  const highestNonWinnerTotal = Math.max(
    0,
    ...rolls.filter((roll) => !roll.isWinner).map((roll) => roll.total),
  );

  rolls
    .filter((roll) => roll.isWinner)
    .forEach((roll) => {
      while (roll.total <= highestNonWinnerTotal && roll.turns.some((value) => value < 6)) {
        const targetIndex = roll.turns.findIndex((value) => value < 6);
        roll.turns[targetIndex] += 1;
        roll.total += 1;
      }
    });

  return rolls
    .sort((left, right) => right.total - left.total)
    .map((roll, index) => ({
      ...roll,
      rank: index + 1,
    }));
}

function createVoteShowRows(
  cards: BroadcastCandidateCard[],
  winnerIdSet: Set<string>,
  rng: () => number,
): VoteShowRow[] {
  if (cards.length === 0) {
    return [];
  }

  const weighted = cards.map((card) => ({
    card,
    weight: winnerIdSet.has(card.participantId)
      ? randomInt(rng, 34, 56)
      : randomInt(rng, 8, 28),
  }));
  const weightTotal = weighted.reduce((sum, row) => sum + row.weight, 0);
  let remaining = 100;

  const rows = weighted.map((row, index) => {
    const isLast = index === weighted.length - 1;
    const percent = isLast
      ? remaining
      : Math.max(1, Math.round((row.weight / weightTotal) * 100));
    remaining -= percent;

    return {
      participantId: row.card.participantId,
      name: row.card.name,
      isWinner: winnerIdSet.has(row.card.participantId),
      percent,
      rank: 0,
    };
  });

  while (remaining !== 0) {
    const target = rows.find((row) => row.percent + Math.sign(remaining) > 0) ?? rows[0];
    target.percent += Math.sign(remaining);
    remaining -= Math.sign(remaining);
  }

  return rows
    .sort((left, right) => right.percent - left.percent)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

export function createDefaultShowSteps(durationMs: number): ShowProcessStep[] {
  if (!Number.isFinite(durationMs) || durationMs < 6000) {
    throw new Error("Show duration must be at least 6000ms.");
  }

  return [
    {
      phase: "ready",
      startMs: 0,
      endMs: Math.round(durationMs * 0.1),
      label: "READY",
    },
    {
      phase: "start",
      startMs: Math.round(durationMs * 0.1),
      endMs: Math.round(durationMs * 0.2),
      label: "START",
    },
    {
      phase: "shuffle",
      startMs: Math.round(durationMs * 0.2),
      endMs: Math.round(durationMs * 0.55),
      label: "LEAD CHANGE",
    },
    {
      phase: "chase",
      startMs: Math.round(durationMs * 0.55),
      endMs: Math.round(durationMs * 0.78),
      label: "FINAL CHASE",
    },
    {
      phase: "slowdown",
      startMs: Math.round(durationMs * 0.78),
      endMs: Math.round(durationMs * 0.9),
      label: "PHOTO FINISH",
    },
    {
      phase: "finish",
      startMs: Math.round(durationMs * 0.9),
      endMs: Math.round(durationMs * 0.96),
      label: "FINISH",
    },
    {
      phase: "reveal",
      startMs: Math.round(durationMs * 0.96),
      endMs: durationMs,
      label: "WINNER REVEAL",
    },
  ];
}

function createRaceShowLanes(
  cards: BroadcastCandidateCard[],
  winnerIdSet: Set<string>,
  rng: () => number,
  durationMs: number,
): RaceShowLane[] {
  return cards.map((card, index) => {
    const isWinner = winnerIdSet.has(card.participantId);
    const earlyLead = 22 + randomInt(rng, 0, 45);
    const midRace = 35 + randomInt(rng, 0, 38);
    const chase = isWinner ? 72 + randomInt(rng, 0, 8) : 50 + randomInt(rng, 0, 24);
    const finish = isWinner ? 100 : 62 + randomInt(rng, 0, 26);

    return {
      participantId: card.participantId,
      name: card.name,
      lane: index + 1,
      isWinner,
      keyframes: [
        { atMs: 0, positionPercent: 4 },
        { atMs: Math.round(durationMs * 0.22), positionPercent: earlyLead },
        { atMs: Math.round(durationMs * 0.52), positionPercent: midRace },
        { atMs: Math.round(durationMs * 0.78), positionPercent: chase },
        { atMs: durationMs, positionPercent: finish },
      ],
    };
  });
}

function createSeededRng(seed: string): () => number {
  let state = hashString(seed);

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, 0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
