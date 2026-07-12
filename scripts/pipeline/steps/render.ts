import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { ReelCompositionProps } from "../../../remotion/ReelComposition";

const COMPOSITION_ID = "Reel";

// Renders the final composited reel and returns the encoded MP4 bytes. Inputs
// (creatorVideoSrc, each brollClips[].src) must be local file paths, not
// remote URLs -- callers are responsible for staging those files first so
// the render doesn't depend on network availability mid-render.
export async function renderReel(props: ReelCompositionProps): Promise<Buffer> {
  const entryPoint = path.join(process.cwd(), "remotion", "index.ts");
  const serveUrl = await bundle({ entryPoint });

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps: props,
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "viralframe-render-"));
  const outputLocation = path.join(tempDir, "output.mp4");

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps: props,
  });

  const output = await fs.readFile(outputLocation);
  await fs.rm(tempDir, { recursive: true, force: true });
  return output;
}
