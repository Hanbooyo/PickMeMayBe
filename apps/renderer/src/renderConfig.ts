export type RenderOutputConfig = {
  compositionId: string;
  entryPoint: string;
  outputPath: string;
};

export function createSampleRenderOutputConfig(
  outputPath = "data/renders/election-broadcast-sample.mp4",
): RenderOutputConfig {
  return {
    compositionId: "ElectionBroadcastReveal",
    entryPoint: "apps/renderer/src/Root.tsx",
    outputPath,
  };
}
