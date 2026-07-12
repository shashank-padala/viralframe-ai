"use server";

import { createClient } from "@/lib/supabase/server";

const WORKFLOW_FILE = "process-video.yml";
const WORKFLOW_REF = "main";
// Not secret, not environment-specific -- only changes if the repo is
// literally renamed, which would already require touching README/docs
// elsewhere. Not worth a Vercel env var for that.
const REPO_OWNER = "shashank-padala";
const REPO_NAME = "viralframe-ai";

type PipelineMode = "full" | "cover_only";

async function dispatchWorkflow(projectId: string, mode: PipelineMode): Promise<void> {
  const token = process.env.GITHUB_ACTIONS_TOKEN;

  if (!token) {
    throw new Error("GITHUB_ACTIONS_TOKEN must be set to start processing.");
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: WORKFLOW_REF, inputs: { project_id: projectId, mode } }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to start processing: ${res.status} ${await res.text()}`);
  }
}

// Called right after a project row + source video upload are created.
// On dispatch failure, marks the project failed immediately rather than
// leaving it stuck in "processing" with nothing actually running.
export async function dispatchPipelineAction(projectId: string): Promise<void> {
  try {
    await dispatchWorkflow(projectId, "full");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const supabase = await createClient();
    await supabase
      .from("projects")
      .update({ pipeline_stage: "failed", status: "failed", error_message: message })
      .eq("id", projectId);
    throw error;
  }
}

// Re-runs the whole pipeline for a project that previously failed.
export async function retryPipelineAction(projectId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ pipeline_stage: null, status: "processing", error_message: null })
    .eq("id", projectId);
  if (error) {
    throw new Error(`Could not reset project for retry: ${error.message}`);
  }
  await dispatchPipelineAction(projectId);
}

// Regenerates only the cover image for an already-ready project. Does not
// touch transcript/hooks/b-roll/render, and critically does not re-pay for
// Kling -- that's the whole point of this being a separate action from
// retryPipelineAction.
export async function regenerateCoverAction(projectId: string): Promise<void> {
  const supabase = await createClient();
  const { error: resetError } = await supabase
    .from("projects")
    .update({ pipeline_stage: "generating_cover", error_message: null })
    .eq("id", projectId);
  if (resetError) {
    throw new Error(`Could not start cover regeneration: ${resetError.message}`);
  }

  try {
    await dispatchWorkflow(projectId, "cover_only");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("projects")
      .update({ pipeline_stage: "failed", error_message: message })
      .eq("id", projectId);
    throw error;
  }
}
