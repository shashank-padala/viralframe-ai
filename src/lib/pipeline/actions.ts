"use server";

import { createClient } from "@/lib/supabase/server";

const WORKFLOW_FILE = "process-video.yml";
const WORKFLOW_REF = "main";

async function dispatchWorkflow(projectId: string): Promise<void> {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    throw new Error(
      "GITHUB_ACTIONS_TOKEN, GITHUB_REPO_OWNER, and GITHUB_REPO_NAME must be set to start processing."
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: WORKFLOW_REF, inputs: { project_id: projectId } }),
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
    await dispatchWorkflow(projectId);
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
