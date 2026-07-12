import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { PipelineContext } from "../lib/context";
import { falSubmitAndAwaitResult, downloadFromUrl } from "../lib/fal";

const execFileAsync = promisify(execFile);

const GROK_IMAGE_MODEL_ID = "xai/grok-imagine-image/edit";

interface FalImageResult {
  images?: { url: string }[];
}

async function extractFrame(localVideoPath: string, atSeconds: number): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cover-frame-"));
  const framePath = path.join(tempDir, "frame.png");
  try {
    await execFileAsync("ffmpeg", [
      "-ss",
      String(atSeconds),
      "-i",
      localVideoPath,
      "-frames:v",
      "1",
      "-y",
      framePath,
    ]);
    return await fs.readFile(framePath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function editWithGrok(prompt: string, referenceImageUrl: string): Promise<Buffer> {
  const result = await falSubmitAndAwaitResult<FalImageResult>(
    GROK_IMAGE_MODEL_ID,
    { prompt, image_urls: [referenceImageUrl], aspect_ratio: "9:16" },
    { pollIntervalMs: 3000, maxPollAttempts: 40 } // ~2 minutes
  );
  const imageUrl = result.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("fal.ai Grok Imagine result is missing images[0].url");
  }
  return downloadFromUrl(imageUrl);
}

// Extracts a frame of the creator's face from their own video, uploads it so
// fal.ai can fetch it by URL, then composites it over an AI-generated
// background matching the video's topic via Grok Imagine's edit endpoint.
export async function generateCoverImage(
  ctx: PipelineContext,
  localVideoPath: string,
  topic: string
): Promise<Buffer> {
  const frame = await extractFrame(localVideoPath, 2);
  const framePath = `${ctx.project.user_id}/${ctx.projectId}/cover-source-frame.png`;
  const referenceImageUrl = await ctx.uploadAndSignExport(framePath, frame, "image/png");

  const prompt =
    `Composite the person from the reference photo over a bold, high-contrast ` +
    `AI-generated background that visually matches the topic "${topic}". Keep the ` +
    `person clearly recognizable and unmodified. Leave clear open space in the upper ` +
    `third of the frame for overlay text. Punchy, scroll-stopping, optimized for ` +
    `click-through as a short-form video cover.`;

  return editWithGrok(prompt, referenceImageUrl);
}
