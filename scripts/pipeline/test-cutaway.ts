// One-off exploratory script -- NOT part of the regular pipeline.
//
// Renders a "cutaway" style test video using:
//  - the real transcript/hook already stored for a project (no new LLM call)
//  - already-completed Kling clips fetched by their known request_id
//    (free -- fal.ai still has the results, we just never downloaded them
//    due to the now-fixed 405 bug)
// No new Kling generations, no new spend. Just to see the cutaway style.

import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

import { createAdminClient } from "./lib/supabaseAdmin";
import { PipelineContext } from "./lib/context";
import { downloadToFile, writeBufferToFile } from "./lib/download";
import { downloadFromUrl } from "./lib/fal";
import { renderReel } from "./steps/render";
import type { ReelCompositionProps } from "../../remotion/ReelComposition";

const PROJECT_ID = "9225abd2-1c66-461b-b1aa-cefea50d2d34";
const FAL_KLING_BASE = "https://queue.fal.run/fal-ai/kling-video/requests";

// Picked for topical variety (skipping the 2 duplicate "factory" prompts).
// 4s windows, shorter than each 5s clip, so there's no freeze-frame mismatch.
const CLIPS = [
  { requestId: "019f5774-9099-7fe0-bfa1-78aab7805419", startSec: 3, label: "factory exterior" },
  { requestId: "019f5774-90d6-7862-819e-4b2f20f1f6c1", startSec: 15, label: "lab scientists" },
  { requestId: "019f5774-90dc-7310-8cfe-e51e95e605cc", startSec: 26, label: "patents/licensing" },
  { requestId: "019f577a-5676-7062-8b1e-8d7b5cf0b6b9", startSec: 37, label: "heat warning" },
];
const CLIP_WINDOW_SECONDS = 4;

interface FalKlingResult {
  video?: { url: string };
}

async function fetchCompletedClip(requestId: string): Promise<Buffer> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is not set");
  const res = await fetch(`${FAL_KLING_BASE}/${requestId}`, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch fal.ai result ${requestId}: ${res.status} ${await res.text()}`);
  }
  const result = (await res.json()) as FalKlingResult;
  const videoUrl = result.video?.url;
  if (!videoUrl) {
    throw new Error(`fal.ai result ${requestId} is missing video.url (may have expired)`);
  }
  return downloadFromUrl(videoUrl);
}

async function main() {
  const client = createAdminClient();
  const ctx = new PipelineContext(client, PROJECT_ID);
  await ctx.load();

  const transcript = ctx.project.transcript as unknown as {
    words: { word: string; start: number; end: number }[];
  } | null;
  if (!transcript) throw new Error("Project has no transcript saved");

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "cutaway-test-"));

  try {
    console.log("Fetching already-completed clips (no new generation)...");
    const brollClips = await Promise.all(
      CLIPS.map(async (clip, i) => {
        console.log(`  - ${clip.label} (${clip.requestId})`);
        const buffer = await fetchCompletedClip(clip.requestId);
        const localPath = path.join(workDir, `broll-${i}.mp4`);
        await writeBufferToFile(buffer, localPath);
        return {
          sceneIndex: i,
          startSec: clip.startSec,
          endSec: clip.startSec + CLIP_WINDOW_SECONDS,
          src: localPath,
        };
      })
    );

    console.log("Downloading creator source video...");
    const sourceVideoUrl = await ctx.getSourceVideoSignedUrl();
    const localCreatorVideoPath = path.join(workDir, "creator.mp4");
    await downloadToFile(sourceVideoUrl, localCreatorVideoPath);

    const compositionProps: ReelCompositionProps = {
      creatorVideoSrc: localCreatorVideoPath,
      brollClips,
      words: transcript.words,
      hook: ctx.project.current_hook ?? "",
      layout: "cutaway",
      captionStyle: ctx.project.caption_style,
      durationInSeconds: 48.5,
    };

    console.log("Rendering...");
    const renderedVideo = await renderReel(compositionProps);

    const outputPath = `${ctx.project.user_id}/${ctx.projectId}/test-cutaway.mp4`;
    await ctx.uploadToExports(outputPath, renderedVideo, "video/mp4");

    const { data: signed } = await client.storage
      .from("reel-exports")
      .createSignedUrl(outputPath, 3600);

    console.log("\nDone. Download URL (valid 1 hour):");
    console.log(signed?.signedUrl);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
