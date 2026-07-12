import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

import { createAdminClient } from "./lib/supabaseAdmin";
import { PipelineContext } from "./lib/context";
import { downloadToFile, writeBufferToFile } from "./lib/download";
import { getVideoDurationSeconds } from "./lib/ffprobe";
import { transcribe } from "./steps/transcribe";
import { generateHooksAndScenes } from "./steps/generateHooksAndScenes";
import { generateAllBrollClips } from "./steps/generateBroll";
import { renderReel } from "./steps/render";
import { generateCoverImage } from "./steps/generateCover";
import type { ReelCompositionProps } from "../../remotion/ReelComposition";

async function main() {
  const projectId = process.argv[2] ?? process.env.PROJECT_ID;
  if (!projectId) {
    throw new Error("Usage: tsx scripts/pipeline/run.ts <project-id> (or set PROJECT_ID)");
  }

  const client = createAdminClient();
  const ctx = new PipelineContext(client, projectId);
  await ctx.load();

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "viralframe-pipeline-"));

  try {
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
    await ctx.setStage("generating_broll");
    const brollResults =
      ctx.project.layout === "full"
        ? []
        : await generateAllBrollClips(ctx, scenes, ctx.project.broll_model);

    // Stage local files -- rendering reads local paths, not remote URLs, so
    // the render doesn't depend on network availability mid-render.
    const localCreatorVideoPath = path.join(workDir, "creator.mp4");
    await downloadToFile(sourceVideoUrl, localCreatorVideoPath);

    const localBrollClips = await Promise.all(
      brollResults.map(async (result) => {
        const localPath = path.join(workDir, `broll-${result.scene.index}.mp4`);
        await writeBufferToFile(result.buffer, localPath);
        return {
          sceneIndex: result.scene.index,
          startSec: result.scene.startSec,
          endSec: result.scene.endSec,
          src: localPath,
        };
      })
    );

    // 4. Render
    await ctx.setStage("rendering");
    const durationInSeconds = await getVideoDurationSeconds(localCreatorVideoPath);
    const compositionProps: ReelCompositionProps = {
      creatorVideoSrc: localCreatorVideoPath,
      brollClips: localBrollClips,
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
    const cover = await generateCoverImage(localCreatorVideoPath, ctx.project.title);
    const coverPath = `${ctx.project.user_id}/${ctx.projectId}/cover.png`;
    await ctx.uploadToExports(coverPath, cover, "image/png");
    await ctx.setCoverImagePath(coverPath);

    await ctx.markReady();
    console.log(`Project ${projectId} is ready.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Pipeline failed for project ${projectId}: ${message}`);
    await ctx.setFailed(message);
    process.exitCode = 1;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
