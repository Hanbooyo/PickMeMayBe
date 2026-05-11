import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { validateMp4RenderArtifact } from "../dist/packages/render-validation/src/index.js";

test("validateMp4RenderArtifact accepts a non-empty MP4-like artifact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-render-"));
  const artifactPath = join(directory, "sample.mp4");

  try {
    await writeFile(
      artifactPath,
      Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42"), Buffer.alloc(2048)]),
    );

    assert.deepEqual(await validateMp4RenderArtifact(artifactPath), {
      path: artifactPath,
      sizeBytes: 2060,
      format: "mp4",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("validateMp4RenderArtifact rejects tiny artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-render-"));
  const artifactPath = join(directory, "tiny.mp4");

  try {
    await writeFile(artifactPath, Buffer.from([0, 0, 0, 8, 102, 116, 121, 112]));

    await assert.rejects(
      validateMp4RenderArtifact(artifactPath),
      /Render artifact is too small/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("validateMp4RenderArtifact rejects non-MP4 artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pick-me-maybe-render-"));
  const artifactPath = join(directory, "not-video.mp4");

  try {
    await writeFile(artifactPath, Buffer.alloc(2048, "x"));

    await assert.rejects(
      validateMp4RenderArtifact(artifactPath),
      /not a valid MP4/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
