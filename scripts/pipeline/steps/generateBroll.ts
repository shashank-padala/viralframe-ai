import type { BrollModel } from "@/lib/supabase/types";
import type { BrollScene } from "../lib/types";
import { falSubmitAndAwaitResult, downloadFromUrl } from "../lib/fal";
import type { PipelineContext } from "../lib/context";

const KLING_MODEL_ID = "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";

interface FalKlingResult {
  video?: { url: string };
}

async function generateKlingClip(prompt: string): Promise<Buffer> {
  const result = await falSubmitAndAwaitResult<FalKlingResult>(
    KLING_MODEL_ID,
    { prompt, duration: "5", aspect_ratio: "9:16" },
    { pollIntervalMs: 10_000, maxPollAttempts: 60 } // ~10 minutes per clip
  );
  const videoUrl = result.video?.url;
  if (!videoUrl) {
    throw new Error("fal.ai Kling result is missing video.url");
  }
  return downloadFromUrl(videoUrl);
}

// No retry wrapper here deliberately: a Kling submission is billed as soon
// as it's accepted, and generateKlingClip covers submit+poll+download as
// one unit. Auto-retrying that whole unit on any failure -- including a
// failure after a successful, already-paid-for submission -- means
// silently paying twice. A single failure surfaces once; re-running is the
// user's explicit choice (Retry / Regenerate), not something done for them.
async function generateClip(scene: BrollScene, model: BrollModel): Promise<Buffer> {
  if (model !== "kling") {
    throw new Error(
      `B-roll model "${model}" is not implemented yet -- only "kling" is currently wired up.`
    );
  }
  return generateKlingClip(scene.prompt);
}

interface BrollClipResult {
  scene: BrollScene;
  storagePath: string;
  buffer: Buffer;
}

// Uses allSettled rather than Promise.all deliberately: Kling jobs are
// submitted (and billed) as soon as the request is accepted, not when we
// finish polling for the result. Promise.all rejects -- and this function
// returns -- the instant any one scene fails, which would abandon other
// scenes mid-poll: already paid for, generated on fal.ai's side, but never
// downloaded or saved. allSettled lets every submitted job run to
// completion so nothing already-charged gets thrown away, even though the
// overall run still fails if any scene didn't make it.
export async function generateAllBrollClips(
  ctx: PipelineContext,
  scenes: BrollScene[],
  model: BrollModel
): Promise<BrollClipResult[]> {
  const settled = await Promise.allSettled(
    scenes.map(async (scene): Promise<BrollClipResult> => {
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

  const failures = settled.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );
  if (failures.length > 0) {
    const detail = failures
      .map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason)))
      .join("; ");
    throw new Error(
      `${failures.length}/${scenes.length} b-roll clips failed to generate: ${detail}`
    );
  }

  return settled.map(
    (r) => (r as PromiseFulfilledResult<BrollClipResult>).value
  );
}
