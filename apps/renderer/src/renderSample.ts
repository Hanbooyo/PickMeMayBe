import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

import { validateMp4RenderArtifact } from "../../../packages/render-validation/src/index.js";
import type { ElectionBroadcastRenderProps } from "../../../packages/render-types/src/index.js";
import { createSampleRenderOutputConfig } from "./renderConfig.js";
import { createElectionBroadcastSampleProps } from "./sampleProps.js";

const config = createSampleRenderOutputConfig(process.argv[2]);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const outputPath = resolve(repoRoot, config.outputPath);

await mkdir(dirname(outputPath), { recursive: true });

const bundled = await bundle({
  entryPoint: resolve(repoRoot, config.entryPoint),
  webpackOverride: (webpackConfig) => ({
    ...webpackConfig,
    resolve: {
      ...webpackConfig.resolve,
      extensionAlias: {
        ...webpackConfig.resolve?.extensionAlias,
        ".js": [".tsx", ".ts", ".js"],
        ".mjs": [".mts", ".mjs"],
      },
    },
  }),
});
const inputProps = await createDataUriSampleProps(repoRoot);
const composition = await selectComposition({
  serveUrl: bundled,
  id: config.compositionId,
  inputProps,
});

await renderMedia({
  composition,
  serveUrl: bundled,
  inputProps,
  codec: "h264",
  outputLocation: outputPath,
});

const artifact = await validateMp4RenderArtifact(outputPath);

console.log(
  `Rendered sample video: ${artifact.path} (${artifact.sizeBytes} bytes)`,
);

async function createDataUriSampleProps(
  rootDirectory: string,
): Promise<ElectionBroadcastRenderProps> {
  const props = createElectionBroadcastSampleProps();
  const dataUriByParticipantId = new Map<string, string>();

  for (const asset of props.assets) {
    dataUriByParticipantId.set(
      asset.participantId,
      await svgFileToDataUri(resolve(rootDirectory, asset.imagePath)),
    );
  }

  return {
    ...props,
    scenario: {
      ...props.scenario,
      cards: props.scenario.cards.map((card) => ({
        ...card,
        imagePath: dataUriByParticipantId.get(card.participantId) ?? card.imagePath,
      })),
    },
    assets: props.assets.map((asset) => ({
      ...asset,
      imagePath: dataUriByParticipantId.get(asset.participantId) ?? asset.imagePath,
    })),
  };
}

async function svgFileToDataUri(path: string): Promise<string> {
  const content = await readFile(path);

  return `data:image/svg+xml;base64,${content.toString("base64")}`;
}
