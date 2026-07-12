import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { ReelCompositionProps } from "../../../remotion/ReelComposition";

const COMPOSITION_ID = "Reel";

// Renders the final composited reel and returns the encoded MP4 bytes.
//
// Inputs (creatorVideoSrc, each brollClips[].src) must be remote HTTP(S)
// URLs, not local file paths. Remotion's renderer runs headless Chrome,
// which has no filesystem access -- it can only fetch assets over HTTP.
// Passing a bare absolute path (e.g. "/tmp/x/video.mp4") produces a 404
// against Remotion's local dev server, which treats it as a URL path, not
// an OS path. (Remotion's own docs confirm this: local files must be
// served, e.g. via `staticFile()` from the bundled public/ dir -- neither
// of which fits dynamically-downloaded per-render assets. Passing the
// already-available remote URL directly is simpler and correct.)
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
