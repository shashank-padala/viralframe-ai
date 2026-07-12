import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { PipelineContext } from "../lib/context";
import { sleep } from "../lib/retry";

const execFileAsync = promisify(execFile);

const FAL_QUEUE_BASE = "https://queue.fal.run";
const GROK_IMAGE_MODEL_ID = "xai/grok-imagine-image/edit";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // ~2 minutes

interface FalSubmitResponse {
  request_id: string;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
}

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
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is not set");

  const headers = {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };

  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${GROK_IMAGE_MODEL_ID}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      image_urls: [referenceImageUrl],
      aspect_ratio: "9:16",
    }),
  });
  if (!submitRes.ok) {
    throw new Error(
      `fal.ai Grok Imagine submit failed: ${submitRes.status} ${await submitRes.text()}`
    );
  }
  const { request_id: requestId } = (await submitRes.json()) as FalSubmitResponse;

  const statusUrl = `${FAL_QUEUE_BASE}/${GROK_IMAGE_MODEL_ID}/requests/${requestId}/status`;
  let completed = false;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const statusRes = await fetch(statusUrl, { headers });
    if (!statusRes.ok) {
      throw new Error(
        `fal.ai status check failed: ${statusRes.status} ${await statusRes.text()}`
      );
    }
    const status = (await statusRes.json()) as FalStatusResponse;
    if (status.status === "COMPLETED") {
      completed = true;
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  if (!completed) {
    throw new Error(`fal.ai Grok Imagine job ${requestId} timed out waiting for completion`);
  }

  const resultUrl = `${FAL_QUEUE_BASE}/${GROK_IMAGE_MODEL_ID}/requests/${requestId}`;
  const resultRes = await fetch(resultUrl, { headers });
  if (!resultRes.ok) {
    throw new Error(
      `fal.ai result fetch failed: ${resultRes.status} ${await resultRes.text()}`
    );
  }
  const result = (await resultRes.json()) as FalImageResult;
  const imageUrl = result.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("fal.ai Grok Imagine result is missing images[0].url");
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to download generated cover: ${imageRes.status}`);
  }
  return Buffer.from(await imageRes.arrayBuffer());
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
