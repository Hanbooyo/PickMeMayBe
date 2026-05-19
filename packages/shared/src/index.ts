export type ParticipantInputSource = "excel" | "manual";

export type Participant = {
  id: string;
  inputSource: ParticipantInputSource;
  name: string;
  email?: string;
  department?: string;
  appliedAsset?: string;
  submittedAt?: string;
};

export type RosterRow = {
  name: string;
  email?: string;
  department?: string;
  appliedAsset?: string;
  submittedAt?: string;
};

export type ManualParticipantInput = {
  name: string;
  email?: string;
  department?: string;
  appliedAsset?: string;
};

export type VisualAssetMatchMethod =
  | "name"
  | "email"
  | "name-and-department";

export type MatchedVisualAsset = {
  participantId: string;
  imagePath: string;
  status: "matched";
  matchedBy: VisualAssetMatchMethod;
};

export type AnonymousVisualAsset = {
  participantId: string;
  imagePath: string;
  status: "anonymous";
  matchedBy: "fallback";
};

export type VisualAsset = MatchedVisualAsset | AnonymousVisualAsset;

export type RaffleOptions = {
  winnerCount: number;
  allowPreviousWinners: boolean;
};

export type RaffleProof = {
  algorithmVersion: string;
  randomSource: "crypto" | "injected";
  randomSeed?: string;
  inputHash: string;
  settingsHash: string;
  resultHash: string;
  candidateCount: number;
  winnerCount: number;
};

export type RaffleResult = {
  id: string;
  winnerIds: string[];
  candidateIds: string[];
  options: RaffleOptions;
  createdAt: string;
  proof?: RaffleProof;
};

export type PresentationMode =
  | "election-broadcast"
  | "individual-reveal"
  | "rock-paper-scissors"
  | "ladder-game"
  | "horse-race"
  | "running-race"
  | "dice-roll"
  | "rolling-picker";

export type PresentationScenario = {
  id: string;
  mode: PresentationMode;
  raffleResultId: string;
  participantIds: string[];
  winnerIds: string[];
  durationSeconds: number;
};

export type RenderJobStatus = "queued" | "running" | "completed" | "failed";

export type RenderJob = {
  id: string;
  scenarioId: string;
  status: RenderJobStatus;
  outputPath?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};
