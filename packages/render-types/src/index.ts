import type { ElectionBroadcastScenario } from "../../presentation-engine/src/index.js";

export type RenderAspectRatio = "16:9" | "9:16" | "1:1";

export type RenderResolution = {
  width: number;
  height: number;
};

export type RenderVideoSettings = {
  aspectRatio: RenderAspectRatio;
  resolution: RenderResolution;
  fps: number;
  durationSeconds: number;
  totalFrames: number;
};

export type RenderAsset = {
  participantId: string;
  imagePath: string;
};

export type ElectionBroadcastRenderProps = {
  scenario: ElectionBroadcastScenario;
  video: RenderVideoSettings;
  assets: RenderAsset[];
};

export function createLandscapeRenderSettings(
  durationSeconds: number,
  fps = 30,
): RenderVideoSettings {
  validatePositiveNumber("durationSeconds", durationSeconds);
  validatePositiveInteger("fps", fps);

  return {
    aspectRatio: "16:9",
    resolution: {
      width: 1920,
      height: 1080,
    },
    fps,
    durationSeconds,
    totalFrames: Math.ceil(durationSeconds * fps),
  };
}

export function createElectionBroadcastRenderProps(
  scenario: ElectionBroadcastScenario,
  fps = 30,
): ElectionBroadcastRenderProps {
  const video = createLandscapeRenderSettings(scenario.durationSeconds, fps);

  return {
    scenario,
    video,
    assets: scenario.cards.map((card) => ({
      participantId: card.participantId,
      imagePath: card.imagePath,
    })),
  };
}

function validatePositiveNumber(field: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number.`);
  }
}

function validatePositiveInteger(field: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
}
