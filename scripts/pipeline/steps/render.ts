import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { serveLocalDir } from "../lib/assetServer";
import type { ReelCompositionProps } from "../../../remotion/ReelComposition";

const COMPOSITION_ID = "Reel";

// `Omit<ReelCompositionProps, "creatorVideoSrc">` doesn't work here --
// ReelCompositionProps has a `[key: string]: unknown` index signature
// (required by Remotion's typings), and `keyof` on a type with an index
// signature collapses to `string`, so `Omit` silently discards the other
// named properties too. `Pick` with explicit keys sidesteps that.
export type RenderInputProps = Pick<
  ReelCompositionProps,
  "brollClips" | "words" | "hook" | "layout" | "captionStyle" | "durationInSeconds" | "aspectRatio"
>;

// Renders the final composited reel and returns the encoded MP4 bytes.
//
// Asset sourcing is deliberately split in two:
//
// - `brollClips[].src` stay remote HTTP(S) URLs (fal.ai/Supabase). Each
//   clip is only on screen for a few seconds total, so the network fetch
//   cost is small.
// - The creator video is served from a small local HTTP server (via
//   `serve-handler`, Remotion's own documented recommendation for
//   dynamically-downloaded per-render assets) rather than fetched
//   remotely. It's visible for nearly the entire output duration, so
//   Remotion has to seek across most of its frames -- doing that over a
//   remote signed URL made a 48s render take ~17 minutes. Local disk read
//   on the same machine is the fix.
//
// Two things that do NOT work, both confirmed empirically before landing
// on this approach: a bare local *path* passed as a <Video> src (headless
// Chrome has no filesystem access, resolves it as a URL path against
// Remotion's server, 404s); and copying the file into the webpack bundle's
// own public/ directory after bundle() runs (Remotion's docs say this
// should work for server-side rendering, but it still 404'd in practice).
export async function renderReel(
  props: RenderInputProps,
  localCreatorVideoPath: string
): Promise<Buffer> {
  const assetServer = await serveLocalDir(path.dirname(localCreatorVideoPath));

  try {
    const entryPoint = path.join(process.cwd(), "remotion", "index.ts");
    const serveUrl = await bundle({ entryPoint });

    const fullProps: ReelCompositionProps = {
      ...props,
      creatorVideoSrc: `http://127.0.0.1:${assetServer.port}/${path.basename(localCreatorVideoPath)}`,
    };

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps: fullProps,
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "viralframe-render-"));
    const outputLocation = path.join(tempDir, "output.mp4");

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps: fullProps,
      // Remotion's defaults (imageFormat: "jpeg", jpegQuality: 80) JPEG-
      // compress every captured frame before the h264 encode even runs --
      // a real double-lossy pass that visibly softened output vs the
      // source. crf 18 is the standard "visually lossless" h264 target.
      jpegQuality: 100,
      crf: 18,
    });

    const output = await fs.readFile(outputLocation);
    await fs.rm(tempDir, { recursive: true, force: true });
    return output;
  } finally {
    await assetServer.close();
  }
}
