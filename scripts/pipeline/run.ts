import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

import { createAdminClient } from "./lib/supabaseAdmin";
import { PipelineContext } from "./lib/context";
import { downloadToFile } from "./lib/download";
import { getVideoDurationSeconds } from "./lib/ffprobe";
import { transcribe } from "./steps/transcribe";
import { generateHooksAndScenes } from "./steps/generateHooksAndScenes";
import { generateAllBrollClips } from "./steps/generateBroll";
import { renderReel } from "./steps/render";
import { generateCoverImage } from "./steps/generateCover";
import type { ReelCompositionProps } from "../../remotion/ReelComposition";

async function runFullPipeline(ctx: PipelineContext, workDir: string) {
  // 1. Transcribe
  await ctx.setStage("transcribing");
  const sourceVideoUrl = await ctx.getSourceVideoSignedUrl();
  const transcript = await transcribe(sourceVideoUrl);
  await ctx.saveTranscript(transcript);

  // 2. Hooks + b-roll scene prompts
  await ctx.setStage("writing_hooks");
  const { hooks, scenes } = await generateHooksAndScenes(ctx.project.title, transcript);
  await ctx.saveHooks(hooks);

  // 3. B-roll generation (parallel per scene) -- skipped entirely for the
  // "full" layout, which never shows b-roll, to avoid paying for unused clips.
  // Also the dominant cost of the whole pipeline (~$0.35/clip via Kling) --
  // this is exactly why cover-only regeneration (below) exists as a
  // separate, cheap path instead of re-running everything.
  await ctx.setStage("generating_broll");
  const brollResults =
    ctx.project.layout === "full"
      ? []
      : await generateAllBrollClips(ctx, scenes, ctx.project.broll_model);

  // Local copy is only needed for ffprobe (duration) and the cover step's
  // ffmpeg frame extraction -- both are local binaries. Rendering itself
  // needs a fetchable URL, not a local path (Remotion's renderer runs
  // headless Chrome, which has no filesystem access).
  const localCreatorVideoPath = path.join(workDir, "creator.mp4");
  await downloadToFile(sourceVideoUrl, localCreatorVideoPath);

  const brollClipsWithUrls = await Promise.all(
    brollResults.map(async (result) => ({
      sceneIndex: result.scene.index,
      startSec: result.scene.startSec,
      endSec: result.scene.endSec,
      src: await ctx.getExportsSignedUrl(result.storagePath),
    }))
  );

  // 4. Render
  await ctx.setStage("rendering");
  const durationInSeconds = await getVideoDurationSeconds(localCreatorVideoPath);
  const compositionProps: ReelCompositionProps = {
    creatorVideoSrc: sourceVideoUrl,
    brollClips: brollClipsWithUrls,
    words: transcript.words,
    hook: hooks[0]?.hook ?? "",
    layout: ctx.project.layout,
    captionStyle: ctx.project.caption_style,
    durationInSeconds,
  };
  const renderedVideo = await renderReel(compositionProps);
  const outputPath = `${ctx.project.user_id}/${ctx.projectId}/output.mp4`;
  await ctx.uploadToExports(outputPath, renderedVideo, "video/mp4");
  await ctx.setOutputVideoPath(outputPath);

  // 5. Cover image
  await ctx.setStage("generating_cover");
  const cover = await generateCoverImage(ctx, localCreatorVideoPath, ctx.project.title);
  const coverPath = `${ctx.project.user_id}/${ctx.projectId}/cover.png`;
  await ctx.uploadToExports(coverPath, cover, "image/png");
  await ctx.setCoverImagePath(coverPath);

  await ctx.markReady();
}

// Only re-runs the cover image step, for an already-ready project. Does not
// touch transcript/hooks/b-roll/render -- those are unaffected by a new
// cover, and re-running them would mean paying for Kling again for nothing.
async function runCoverOnly(ctx: PipelineContext, workDir: string) {
  await ctx.setStage("generating_cover");
  const sourceVideoUrl = await ctx.getSourceVideoSignedUrl();
  const localCreatorVideoPath = path.join(workDir, "creator.mp4");
  await downloadToFile(sourceVideoUrl, localCreatorVideoPath);

  const cover = await generateCoverImage(ctx, localCreatorVideoPath, ctx.project.title);
  const coverPath = `${ctx.project.user_id}/${ctx.projectId}/cover.png`;
  await ctx.uploadToExports(coverPath, cover, "image/png");
  await ctx.setCoverImagePath(coverPath);
  await ctx.setStage("ready");
}

async function main() {
  const projectId = process.argv[2] ?? process.env.PROJECT_ID;
  if (!projectId) {
    throw new Error("Usage: tsx scripts/pipeline/run.ts <project-id> [mode] (or set PROJECT_ID/MODE)");
  }
  const mode = process.argv[3] ?? process.env.MODE ?? "full";
  if (mode !== "full" && mode !== "cover_only") {
    throw new Error(`Unknown mode "${mode}" -- expected "full" or "cover_only"`);
  }

  const client = createAdminClient();
  const ctx = new PipelineContext(client, projectId);
  await ctx.load();

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "viralframe-pipeline-"));

  try {
    if (mode === "cover_only") {
      await runCoverOnly(ctx, workDir);
    } else {
      await runFullPipeline(ctx, workDir);
    }
    console.log(`Project ${projectId} (${mode}) is ready.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Pipeline failed for project ${projectId} (${mode}): ${message}`);
    if (mode === "cover_only") {
      // Cover regen failing doesn't mean the video itself is broken --
      // leave `status` alone, only flag the failed background job.
      await ctx.setCoverRegenFailed(message);
    } else {
      await ctx.setFailed(message);
    }
    process.exitCode = 1;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
