import type { BrollModel } from "@/lib/supabase/types";
import type { BrollScene } from "../lib/types";
import { sleep, withRetry } from "../lib/retry";
import type { PipelineContext } from "../lib/context";

const FAL_QUEUE_BASE = "https://queue.fal.run";
const KLING_MODEL_ID = "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 60; // ~10 minutes per clip

interface FalSubmitResponse {
  request_id: string;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  error?: string;
}

interface FalKlingResult {
  video?: { url: string };
}

async function generateKlingClip(prompt: string): Promise<Buffer> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is not set");

  const headers = {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };

  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${KLING_MODEL_ID}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      duration: "5",
      aspect_ratio: "9:16",
    }),
  });
  if (!submitRes.ok) {
    throw new Error(
      `fal.ai Kling submit failed: ${submitRes.status} ${await submitRes.text()}`
    );
  }
  const { request_id: requestId } = (await submitRes.json()) as FalSubmitResponse;

  const statusUrl = `${FAL_QUEUE_BASE}/${KLING_MODEL_ID}/requests/${requestId}/status`;
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
    throw new Error(`fal.ai Kling job ${requestId} timed out waiting for completion`);
  }

  const resultUrl = `${FAL_QUEUE_BASE}/${KLING_MODEL_ID}/requests/${requestId}`;
  const resultRes = await fetch(resultUrl, { headers });
  if (!resultRes.ok) {
    throw new Error(
      `fal.ai result fetch failed: ${resultRes.status} ${await resultRes.text()}`
    );
  }
  const result = (await resultRes.json()) as FalKlingResult;
  const videoUrl = result.video?.url;
  if (!videoUrl) {
    throw new Error("fal.ai Kling result is missing video.url");
  }

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`Failed to download generated clip: ${videoRes.status}`);
  }
  return Buffer.from(await videoRes.arrayBuffer());
}

async function generateClip(scene: BrollScene, model: BrollModel): Promise<Buffer> {
  if (model !== "kling") {
    throw new Error(
      `B-roll model "${model}" is not implemented yet -- only "kling" is currently wired up.`
    );
  }
  return withRetry(() => generateKlingClip(scene.prompt), {
    attempts: 2,
    baseDelayMs: 5000,
  });
}

export async function generateAllBrollClips(
  ctx: PipelineContext,
  scenes: BrollScene[],
  model: BrollModel
) {
  return Promise.all(
    scenes.map(async (scene) => {
      const clipRow = await ctx.createBrollClip(scene.index, scene.prompt, model);
      try {
        const clipBuffer = await generateClip(scene, model);
        const path = `${ctx.project.user_id}/${ctx.projectId}/broll-${scene.index}.mp4`;
        await ctx.uploadBrollClip(path, clipBuffer, "video/mp4");
        await ctx.markBrollClipReady(clipRow.id, path);
        return { scene, storagePath: path, buffer: clipBuffer };
      } catch (error) {
        await ctx.markBrollClipFailed(clipRow.id);
        throw error;
      }
    })
  );
}
