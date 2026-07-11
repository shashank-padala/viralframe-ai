// Generated from the live Supabase schema via `mcp__supabase__generate_typescript_types`.
// Regenerate after any migration change rather than hand-editing the `Database` type.

export type Platform = "reel" | "tiktok" | "shorts";
export type ProjectStatus = "uploaded" | "processing" | "ready" | "failed";
export type Layout = "top" | "bottom" | "full";

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
          caption_style: string;
          cover_image_path: string | null;
          created_at: string;
          current_hook: string | null;
          id: string;
          layout: Layout;
          output_video_path: string | null;
          platform: Platform;
          source_video_path: string;
          status: ProjectStatus;
          style: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          caption_style?: string;
          cover_image_path?: string | null;
          created_at?: string;
          current_hook?: string | null;
          id?: string;
          layout?: Layout;
          output_video_path?: string | null;
          platform?: Platform;
          source_video_path: string;
          status?: ProjectStatus;
          style?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          caption_style?: string;
          cover_image_path?: string | null;
          created_at?: string;
          current_hook?: string | null;
          id?: string;
          layout?: Layout;
          output_video_path?: string | null;
          platform?: Platform;
          source_video_path?: string;
          status?: ProjectStatus;
          style?: string;
          title?: string;
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
