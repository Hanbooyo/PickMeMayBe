export type RenderOutputConfig = {
  compositionId: string;
  entryPoint: string;
  outputPath: string;
  inputPropsPath?: string;
};

export function createSampleRenderOutputConfig(
  outputPath = "data/renders/election-broadcast-sample.mp4",
  inputPropsPath?: string,
): RenderOutputConfig {
  return {
    compositionId: "ElectionBroadcastReveal",
    entryPoint: "apps/renderer/src/remotionEntry.tsx",
    outputPath,
    ...(inputPropsPath ? { inputPropsPath } : {}),
  };
}
