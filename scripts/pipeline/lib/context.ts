import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PipelineStage } from "@/lib/supabase/types";
import type { HookVariation, Transcript } from "./types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

const SOURCE_BUCKET = "source-videos";
const EXPORT_BUCKET = "reel-exports";

export class PipelineContext {
  private client: SupabaseClient<Database>;
  readonly projectId: string;
  project!: Project;

  constructor(client: SupabaseClient<Database>, projectId: string) {
    this.client = client;
    this.projectId = projectId;
  }

  async load() {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("id", this.projectId)
      .single();
    if (error || !data) {
      throw new Error(
        `Could not load project ${this.projectId}: ${error?.message ?? "not found"}`
      );
    }
    this.project = data;
    return data;
  }

  async setStage(stage: PipelineStage) {
    const { error } = await this.client
      .from("projects")
      .update({ pipeline_stage: stage })
      .eq("id", this.projectId);
    if (error) throw new Error(`Failed to set pipeline_stage=${stage}: ${error.message}`);
  }

  async setFailed(message: string) {
    await this.client
      .from("projects")
      .update({ pipeline_stage: "failed", status: "failed", error_message: message })
      .eq("id", this.projectId);
  }

  async getSourceVideoSignedUrl(expiresInSeconds = 3600) {
    const { data, error } = await this.client.storage
      .from(SOURCE_BUCKET)
      .createSignedUrl(this.project.source_video_path, expiresInSeconds);
    if (error || !data) {
      throw new Error(`Failed to sign source video URL: ${error?.message}`);
    }
    return data.signedUrl;
  }

  // Used to hand a locally-generated file (e.g. a ffmpeg-extracted frame) to
  // an external API that needs to fetch it by URL rather than accept a raw
  // upload -- upload it to the exports bucket first, then sign it.
  async uploadAndSignExport(
    path: string,
    data: Buffer,
    contentType: string,
    expiresInSeconds = 3600
  ): Promise<string> {
    await this.uploadToExports(path, data, contentType);
    const { data: signed, error } = await this.client.storage
      .from(EXPORT_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !signed) {
      throw new Error(`Failed to sign ${path}: ${error?.message}`);
    }
    return signed.signedUrl;
  }

  async saveTranscript(transcript: Transcript) {
    const { error } = await this.client
      .from("projects")
      .update({ transcript: transcript as unknown as Database["public"]["Tables"]["projects"]["Row"]["transcript"] })
      .eq("id", this.projectId);
    if (error) throw new Error(`Failed to save transcript: ${error.message}`);
  }

  async saveHooks(hooks: HookVariation[]) {
    const rows = hooks.map((h, i) => ({
      project_id: this.projectId,
      label: h.label,
      hook: h.hook,
      is_selected: i === 0,
    }));
    const { error: insertError } = await this.client.from("reel_variations").insert(rows);
    if (insertError) throw new Error(`Failed to insert reel_variations: ${insertError.message}`);

    const { error: updateError } = await this.client
      .from("projects")
      .update({ current_hook: hooks[0]?.hook ?? null })
      .eq("id", this.projectId);
    if (updateError) throw new Error(`Failed to set current_hook: ${updateError.message}`);
  }

  async createBrollClip(sceneIndex: number, prompt: string, model: string) {
    const { data, error } = await this.client
      .from("broll_clips")
      .insert({
        project_id: this.projectId,
        scene_index: sceneIndex,
        prompt,
        model: model as Database["public"]["Tables"]["broll_clips"]["Row"]["model"],
        status: "generating",
      })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to create broll_clips row: ${error?.message}`);
    return data;
  }

  async markBrollClipReady(clipId: string, storagePath: string) {
    const { error } = await this.client
      .from("broll_clips")
      .update({ status: "ready", storage_path: storagePath })
      .eq("id", clipId);
    if (error) throw new Error(`Failed to mark broll_clips.${clipId} ready: ${error.message}`);
  }

  async markBrollClipFailed(clipId: string) {
    await this.client.from("broll_clips").update({ status: "failed" }).eq("id", clipId);
  }

  async uploadToExports(path: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(EXPORT_BUCKET).upload(path, data, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(`Failed to upload ${path} to ${EXPORT_BUCKET}: ${error.message}`);
    return path;
  }

  async uploadBrollClip(path: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(EXPORT_BUCKET).upload(path, data, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(`Failed to upload ${path} to ${EXPORT_BUCKET}: ${error.message}`);
    return path;
  }

  async setOutputVideoPath(path: string) {
    const { error } = await this.client
      .from("projects")
      .update({ output_video_path: path })
      .eq("id", this.projectId);
    if (error) throw new Error(`Failed to set output_video_path: ${error.message}`);
  }

  async setCoverImagePath(path: string) {
    const { error } = await this.client
      .from("projects")
      .update({ cover_image_path: path })
      .eq("id", this.projectId);
    if (error) throw new Error(`Failed to set cover_image_path: ${error.message}`);
  }

  async markReady() {
    const { error } = await this.client
      .from("projects")
      .update({ pipeline_stage: "ready", status: "ready" })
      .eq("id", this.projectId);
    if (error) throw new Error(`Failed to mark project ready: ${error.message}`);
  }
}
