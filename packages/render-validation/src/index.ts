import { readFile, stat } from "node:fs/promises";

export type RenderArtifactValidationOptions = {
  minBytes?: number;
};

export type RenderArtifactValidationResult = {
  path: string;
  sizeBytes: number;
  format: "mp4";
};

const DEFAULT_MIN_BYTES = 1024;
const MP4_BRAND_OFFSET = 4;
const MP4_BRAND_LENGTH = 8;

export async function validateMp4RenderArtifact(
  path: string,
  options: RenderArtifactValidationOptions = {},
): Promise<RenderArtifactValidationResult> {
  const minBytes = options.minBytes ?? DEFAULT_MIN_BYTES;
  const file = await stat(path);

  if (!file.isFile()) {
    throw new Error(`Render artifact is not a file: ${path}`);
  }

  if (file.size < minBytes) {
    throw new Error(
      `Render artifact is too small: ${file.size} bytes, expected at least ${minBytes}.`,
    );
  }

  const header = await readFile(path, {
    encoding: null,
    flag: "r",
  });
  const brand = header
    .subarray(MP4_BRAND_OFFSET, MP4_BRAND_OFFSET + MP4_BRAND_LENGTH)
    .toString("latin1");

  if (!brand.includes("ftyp")) {
    throw new Error(`Render artifact is not a valid MP4 file: ${path}`);
  }

  return {
    path,
    sizeBytes: file.size,
    format: "mp4",
  };
}
