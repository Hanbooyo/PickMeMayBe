import { mkdir, readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

import { validateMp4RenderArtifact } from "../../../packages/render-validation/src/index.js";
import type { ElectionBroadcastRenderProps } from "../../../packages/render-types/src/index.js";
import { createSampleRenderOutputConfig } from "./renderConfig.js";
import { createElectionBroadcastSampleProps } from "./sampleProps.js";

const config = createSampleRenderOutputConfig(process.argv[2], process.argv[3]);
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
const inputProps = await createDataUriRenderProps(repoRoot, config.inputPropsPath);
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

async function createDataUriRenderProps(
  rootDirectory: string,
  inputPropsPath?: string,
): Promise<ElectionBroadcastRenderProps> {
  const props = inputPropsPath
    ? await readRenderProps(resolve(rootDirectory, inputPropsPath))
    : createElectionBroadcastSampleProps();
  const dataUriByParticipantId = new Map<string, string>();

  for (const asset of props.assets) {
    if (asset.imagePath.startsWith("data:")) {
      dataUriByParticipantId.set(asset.participantId, asset.imagePath);
      continue;
    }

    dataUriByParticipantId.set(
      asset.participantId,
      await imageFileToDataUri(resolve(rootDirectory, asset.imagePath)),
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

async function imageFileToDataUri(path: string): Promise<string> {
  const content = await readFile(path);

  return `${getImageDataUriPrefix(path)},${content.toString("base64")}`;
}

async function readRenderProps(path: string): Promise<ElectionBroadcastRenderProps> {
  return JSON.parse(await readFile(path, "utf8")) as ElectionBroadcastRenderProps;
}

function getImageDataUriPrefix(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "data:image/jpeg;base64";
    case ".png":
      return "data:image/png;base64";
    case ".webp":
      return "data:image/webp;base64";
    case ".svg":
      return "data:image/svg+xml;base64";
    default:
      throw new Error(`Unsupported render asset type: ${path}`);
  }
}
