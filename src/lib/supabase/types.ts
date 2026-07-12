// Generated from the live Supabase schema via `mcp__supabase__generate_typescript_types`.
// Regenerate after any migration change rather than hand-editing the `Database` type.

export type Platform = "reel" | "tiktok" | "shorts";
export type ProjectStatus = "uploaded" | "processing" | "ready" | "failed";
export type Layout = "top" | "bottom" | "full";
export type BrollModel = "kling" | "runway" | "luma" | "veo";
export type PipelineStage =
  | "transcribing"
  | "writing_hooks"
  | "generating_broll"
  | "rendering"
  | "generating_cover"
  | "ready"
  | "failed";
export type BrollClipStatus = "pending" | "generating" | "ready" | "failed";
export type OutputAspectRatio = "9:16" | "16:9";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      broll_clips: {
        Row: {
          created_at: string;
          id: string;
          model: BrollModel;
          project_id: string;
          prompt: string;
          scene_index: number;
          status: BrollClipStatus;
          storage_path: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          model: BrollModel;
          project_id: string;
          prompt: string;
          scene_index: number;
          status?: BrollClipStatus;
          storage_path?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          model?: BrollModel;
          project_id?: string;
          prompt?: string;
          scene_index?: number;
          status?: BrollClipStatus;
          storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "broll_clips_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          plan: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          plan?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          plan?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          broll_model: BrollModel;
          caption_style: string;
          cover_image_path: string | null;
          created_at: string;
          current_hook: string | null;
          error_message: string | null;
          id: string;
          layout: Layout;
          output_aspect_ratio: OutputAspectRatio;
          output_video_path: string | null;
          pipeline_stage: PipelineStage | null;
          platform: Platform;
          source_video_path: string;
          status: ProjectStatus;
          style: string;
          title: string;
          transcript: Json | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          broll_model?: BrollModel;
          caption_style?: string;
          cover_image_path?: string | null;
          created_at?: string;
          current_hook?: string | null;
          error_message?: string | null;
          id?: string;
          layout?: Layout;
          output_aspect_ratio?: OutputAspectRatio;
          output_video_path?: string | null;
          pipeline_stage?: PipelineStage | null;
          platform?: Platform;
          source_video_path: string;
          status?: ProjectStatus;
          style?: string;
          title?: string;
          transcript?: Json | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          broll_model?: BrollModel;
          caption_style?: string;
          cover_image_path?: string | null;
          created_at?: string;
          current_hook?: string | null;
          error_message?: string | null;
          id?: string;
          layout?: Layout;
          output_aspect_ratio?: OutputAspectRatio;
          output_video_path?: string | null;
          pipeline_stage?: PipelineStage | null;
          platform?: Platform;
          source_video_path?: string;
          status?: ProjectStatus;
          style?: string;
          title?: string;
          transcript?: Json | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reel_variations: {
        Row: {
          created_at: string;
          hook: string;
          id: string;
          is_selected: boolean;
          label: string;
          project_id: string;
        };
        Insert: {
          created_at?: string;
          hook: string;
          id?: string;
          is_selected?: boolean;
          label: string;
          project_id: string;
        };
        Update: {
          created_at?: string;
          hook?: string;
          id?: string;
          is_selected?: boolean;
          label?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reel_variations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
