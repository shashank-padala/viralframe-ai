"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, FileVideo, Film, Sparkles, Play, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReelMockup } from "@/components/site/reel-mockup";
import { createClient } from "@/lib/supabase/client";
import { dispatchPipelineAction } from "@/lib/pipeline/actions";
import type { BrollModel, Platform } from "@/lib/supabase/types";

const platforms: { id: Platform; label: string }[] = [
  { id: "reel", label: "Instagram Reel" },
  { id: "tiktok", label: "TikTok" },
  { id: "shorts", label: "YouTube Shorts" },
];

const brollModels: { id: BrollModel; label: string; description: string }[] = [
  { id: "kling", label: "Kling 2.5", description: "Strong motion, good default" },
  { id: "runway", label: "Runway Gen-4", description: "Most cinematic, priciest" },
  { id: "luma", label: "Luma Ray2", description: "Fast, stylized" },
  { id: "veo", label: "Google Veo 3", description: "Photorealistic, has audio" },
];

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];

type HistoryItem = {
  id: string;
  title: string;
  current_hook: string | null;
  status: string;
  created_at: string;
};

export function DashboardClient({
  userId,
  history,
  remainingFreeVideos,
  plan,
}: {
  userId: string;
  history: HistoryItem[];
  remainingFreeVideos: number;
  plan: string;
}) {
  const [platform, setPlatform] = useState<Platform>("reel");
  const [style, setStyle] = useState("business");
  const [brollModel, setBrollModel] = useState<BrollModel>("kling");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function startUpload(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload an MP4 or MOV file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Videos must be under 2GB.");
      return;
    }
    if (plan === "free" && remainingFreeVideos <= 0) {
      toast.error("You've used all 3 free videos this month. Upgrade to keep creating.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const projectId = crypto.randomUUID();
    const path = `${userId}/${projectId}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("source-videos")
      .upload(path, file);

    if (uploadError) {
      toast.error(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("projects").insert({
      id: projectId,
      user_id: userId,
      title: file.name.replace(/\.[^./]+$/, ""),
      platform,
      style,
      broll_model: brollModel,
      status: "processing",
      source_video_path: path,
    });

    if (insertError) {
      toast.error(`Could not start your reel: ${insertError.message}`);
      setUploading(false);
      return;
    }

    try {
      await dispatchPipelineAction(projectId);
    } catch {
      toast.error("Couldn't start processing -- see the error on the next screen.");
    }

    router.push(`/processing?projectId=${projectId}`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-brand">
            Studio
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Create a{" "}
            <span className="font-display italic text-gradient-brand">viral reel</span>
          </h1>
        </div>
        <div className="hidden text-sm text-muted-foreground md:block">
          {remainingFreeVideos} free videos remaining this month
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Upload */}
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) startUpload(file);
            }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            role="button"
            aria-disabled={uploading}
            className={`group relative flex aspect-[16/10] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
              dragOver
                ? "border-brand bg-brand/5"
                : "border-border/60 bg-surface/40 hover:border-brand/50"
            } ${uploading ? "pointer-events-none opacity-70" : ""}`}
          >
            <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
            <div className="relative flex flex-col items-center text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary-foreground" />
                ) : (
                  <Upload className="h-6 w-6 text-primary-foreground" />
                )}
              </div>
              <div className="mt-5 text-lg font-semibold">
                {uploading ? "Uploading…" : "Upload video"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {uploading ? (
                  "Hang tight, this can take a minute."
                ) : (
                  <>
                    Drag &amp; drop or <span className="text-brand">browse files</span>
                  </>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <FileVideo className="h-3 w-3" /> MP4, MOV · up to 2GB
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="mt-6 grid gap-4 rounded-2xl border border-border/60 bg-surface/40 p-6 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Platform
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {platforms.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      platform === p.id
                        ? "border-transparent bg-gradient-brand text-primary-foreground shadow-glow"
                        : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Style
              </div>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="mt-3 bg-background/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business Creator</SelectItem>
                  <SelectItem value="podcast">Podcast</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="news">News Commentary</SelectItem>
                  <SelectItem value="product">Product Marketing</SelectItem>
                  <SelectItem value="story">Storytelling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                B-roll AI model
              </div>
              <Select
                value={brollModel}
                onValueChange={(v) => setBrollModel(v as BrollModel)}
              >
                <SelectTrigger className="mt-3 bg-background/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brollModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} — {m.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Preview column */}
        <div className="rounded-2xl border border-border/60 bg-surface/40 p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-brand" /> Preview style
          </div>
          <div className="mt-6 flex justify-center">
            <ReelMockup compact hook="Your hook will go here" />
          </div>
          <Button
            className="mt-6 w-full bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Play className="mr-2 h-4 w-4" /> Generate reel
          </Button>
        </div>
      </div>

      {/* History */}
      <div className="mt-16">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Your creations</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="group flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-surface/30 text-muted-foreground transition hover:border-brand/50 hover:text-foreground"
          >
            <Plus className="h-6 w-6" />
            <span className="mt-2 text-sm">New reel</span>
          </button>
          {history.map((h) => (
            <Link
              key={h.id}
              href={`/results?projectId=${h.id}`}
              className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-surface to-surface-2 p-4"
            >
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
                <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
                  <Film className="mr-1 inline h-2.5 w-2.5" />{" "}
                  {h.status === "processing" ? "Processing" : "Reel"}
                </span>
                <span className="text-[10px] text-white/60">
                  {new Date(h.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              {h.current_hook && (
                <div className="text-[11px] uppercase tracking-widest text-brand">
                  {h.current_hook}
                </div>
              )}
              <div className="mt-1 text-sm font-semibold text-white">{h.title}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
