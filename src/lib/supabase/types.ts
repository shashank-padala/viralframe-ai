export type Platform = "reel" | "tiktok" | "shorts";
export type ProjectStatus = "uploaded" | "processing" | "ready" | "failed";
export type Layout = "top" | "bottom" | "full";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          plan: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          platform: Platform;
          style: string;
          status: ProjectStatus;
          layout: Layout;
          caption_style: string;
          current_hook: string | null;
          source_video_path: string;
          cover_image_path: string | null;
          output_video_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          platform?: Platform;
          style?: string;
          status?: ProjectStatus;
          layout?: Layout;
          caption_style?: string;
          current_hook?: string | null;
          source_video_path: string;
          cover_image_path?: string | null;
          output_video_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          platform?: Platform;
          style?: string;
          status?: ProjectStatus;
          layout?: Layout;
          caption_style?: string;
          current_hook?: string | null;
          source_video_path?: string;
          cover_image_path?: string | null;
          output_video_path?: string | null;
          created_at?: string;
          updated_at?: string;
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
          id: string;
          project_id: string;
          label: string;
          hook: string;
          is_selected: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          label: string;
          hook: string;
          is_selected?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          label?: string;
          hook?: string;
          is_selected?: boolean;
          created_at?: string;
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
  };
}
