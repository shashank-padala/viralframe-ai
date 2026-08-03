import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { serveLocalDir } from "../../pipeline/lib/assetServer";
import type { CaptionedVideoProps } from "../../../remotion/CaptionedVideo";
import type { EditDocument } from "../edl";

const COMPOSITION_ID = "CaptionedVideo";

export interface RenderOptions {
  /** Render only this frame window (used by --range previews). */
  frameRange?: [number, number];
  outputPath: string;
  onProgress?: (percent: number) => void;
}

/** h264 cannot encode odd dimensions; a source with one gets nudged down a pixel. */
function toEven(value: number): number {
  return value % 2 === 0 ? value : value - 1;
}

export async function renderCaptionedVideo(
  edl: EditDocument,
  options: RenderOptions
): Promise<void> {
  const assetServer = await serveLocalDir(path.dirname(edl.source.path));

  try {
    const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "remotion", "index.ts") });

    const inputProps: CaptionedVideoProps = {
      videoSrc: `http://127.0.0.1:${assetServer.port}/${encodeURIComponent(path.basename(edl.source.path))}`,
      cards: edl.cards,
      placement: edl.placement,
      styleId: edl.styleId,
      durationInSeconds: edl.source.durationSec,
      fps: edl.source.fps,
      width: toEven(edl.source.width),
      height: toEven(edl.source.height),
    };

    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: options.outputPath,
      inputProps,
      frameRange: options.frameRange,
      // Remotion's defaults JPEG-compress every captured frame before the
      // h264 encode runs -- a double-lossy pass that visibly softens the
      // source. crf 18 is the standard "visually lossless" h264 target.
      jpegQuality: 100,
      crf: 18,
      // Audio is muxed back in from the source afterwards rather than being
      // re-encoded here: it stays bit-identical and the render does less
      // work. See muxWithSourceAudio.
      muted: true,
      // One headless Chrome tab per core. Frame capture, not encoding, is
      // the bottleneck on a long-form render.
      concurrency: Math.max(1, os.cpus().length),
      onProgress: options.onProgress
        ? ({ progress }) => options.onProgress?.(Math.round(progress * 100))
        : undefined,
    });
  } finally {
    await assetServer.close();
  }
}
