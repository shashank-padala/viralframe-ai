import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { ReelCompositionProps } from "../../../remotion/ReelComposition";

const COMPOSITION_ID = "Reel";
const CREATOR_ASSET_RELATIVE_PATH = "creator-assets/creator.mp4";

// `Omit<ReelCompositionProps, "creatorVideoSrc">` doesn't work here --
// ReelCompositionProps has a `[key: string]: unknown` index signature
// (required by Remotion's typings), and `keyof` on a type with an index
// signature collapses to `string`, so `Omit` silently discards the other
// named properties too. `Pick` with explicit keys sidesteps that.
export type RenderInputProps = Pick<
  ReelCompositionProps,
  "brollClips" | "words" | "hook" | "layout" | "captionStyle" | "durationInSeconds"
>;

// Renders the final composited reel and returns the encoded MP4 bytes.
//
// Asset sourcing is deliberately split in two:
//
// - `brollClips[].src` stay remote HTTP(S) URLs. Each clip is only on
//   screen for a few seconds total, so the network fetch cost is small.
// - The creator video is embedded as a LOCAL file into the bundle's own
//   `public/` directory (confirmed via Remotion's docs: server-side
//   rendering APIs can add assets to the bundled public/ folder after
//   bundle() runs, unlike the interactive Studio). It's visible for nearly
//   the entire output duration, so Remotion has to seek across most of its
//   frames -- fetching that over a remote signed URL each time made a 48s
//   render take ~17 minutes. Serving it from local disk (same machine,
//   same run) instead of over the network is the fix.
//
// A bare local *path* passed directly as a <Video> src does NOT work --
// Remotion's renderer runs headless Chrome with no filesystem access, and
// resolves it as a URL path against its own local server, producing a 404.
// It has to be physically copied into the served public/ directory first.
export async function renderReel(
  props: RenderInputProps,
  localCreatorVideoPath: string
): Promise<Buffer> {
  const entryPoint = path.join(process.cwd(), "remotion", "index.ts");
  const serveUrl = await bundle({ entryPoint });

  const assetDest = path.join(serveUrl, "public", CREATOR_ASSET_RELATIVE_PATH);
  await fs.mkdir(path.dirname(assetDest), { recursive: true });
  await fs.copyFile(localCreatorVideoPath, assetDest);

  const fullProps: ReelCompositionProps = {
    ...props,
    creatorVideoSrc: CREATOR_ASSET_RELATIVE_PATH,
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
  });

  const output = await fs.readFile(outputLocation);
  await fs.rm(tempDir, { recursive: true, force: true });
  return output;
}
