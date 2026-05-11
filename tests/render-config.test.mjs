import test from "node:test";
import assert from "node:assert/strict";

import { createSampleRenderOutputConfig } from "../dist/apps/renderer/src/renderConfig.js";

test("createSampleRenderOutputConfig returns sample render paths", () => {
  assert.deepEqual(createSampleRenderOutputConfig(), {
    compositionId: "ElectionBroadcastReveal",
    entryPoint: "apps/renderer/src/remotionEntry.tsx",
    outputPath: "data/renders/election-broadcast-sample.mp4",
  });
});

test("createSampleRenderOutputConfig accepts custom output path", () => {
  assert.equal(
    createSampleRenderOutputConfig("data/renders/custom.mp4").outputPath,
    "data/renders/custom.mp4",
  );
});
