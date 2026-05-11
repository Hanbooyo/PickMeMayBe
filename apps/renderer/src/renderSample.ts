import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

import { createSampleRenderOutputConfig } from "./renderConfig.js";

const config = createSampleRenderOutputConfig(process.argv[2]);
const outputPath = resolve(config.outputPath);

await mkdir(dirname(outputPath), { recursive: true });

const bundled = await bundle({
  entryPoint: resolve(config.entryPoint),
});
const composition = await selectComposition({
  serveUrl: bundled,
  id: config.compositionId,
});

await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: outputPath,
});

console.log(`Rendered sample video: ${outputPath}`);
