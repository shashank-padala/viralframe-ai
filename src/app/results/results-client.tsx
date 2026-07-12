"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  RefreshCw,
  Pencil,
  Share2,
  Image as ImageIcon,
  Film,
  Layers,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ReelMockup } from "@/components/site/reel-mockup";
import { createClient } from "@/lib/supabase/client";
import { retryPipelineAction, regenerateCoverAction } from "@/lib/pipeline/actions";
import type { Database, Layout, PipelineStage } from "@/lib/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Variation = Database["public"]["Tables"]["reel_variations"]["Row"];

const layouts: { id: Layout; label: string }[] = [
  { id: "top", label: "B-roll top / Video bottom" },
  { id: "bottom", label: "Video top / B-roll bottom" },
  { id: "full", label: "Full screen video" },
];

const captions = ["Hormozi style", "Minimal", "News style", "Podcast"];

function notImplemented() {
  toast.info("Not wired up yet.");
}

export function ResultsClient({
  project,
  variations,
}: {
  project: Project;
  variations: Variation[];
}) {
  const [hook, setHook] = useState(project.current_hook ?? "Your hook will go here");
  const [layout, setLayout] = useState<Layout>(project.layout);
  const [caption, setCaption] = useState(project.caption_style);
  const [selectedVariationId, setSelectedVariationId] = useState(
    variations.find((v) => v.is_selected)?.id ?? null
  );
  const [downloading, setDownloading] = useState<"video" | "cover" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [coverRegenerating, setCoverRegenerating] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createClient();

  useEffect(() => {
    if (!project.cover_image_path) return;
    let cancelled = false;
    supabase.storage
      .from("reel-exports")
      .createSignedUrl(project.cover_image_path, 3600)
      .then(({ data }) => {
        if (!cancelled) setCoverImageUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [project.cover_image_path, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`project-cover-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${project.id}`,
        },
        (payload) => {
          const next = payload.new as { pipeline_stage: PipelineStage | null; error_message: string | null };
          if (next.pipeline_stage === "generating_cover") return;
          if (!coverRegenerating) return;
          setCoverRegenerating(false);
          if (next.pipeline_stage === "failed") {
            toast.error(next.error_message ?? "Cover regeneration failed.");
          } else {
            toast.success("Cover updated.");
            router.refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, coverRegenerating]);

  async function downloadExport(path: string | null, kind: "video" | "cover", filename: string) {
    if (!path) {
      toast.error(`No ${kind} has been generated yet.`);
      return;
    }
    setDownloading(kind);
    const { data, error } = await supabase.storage
      .from("reel-exports")
      .createSignedUrl(path, 60);
    setDownloading(null);
    if (error || !data) {
      toast.error(`Couldn't create a download link: ${error?.message}`);
      return;
    }
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = filename;
    link.click();
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard.");
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      await retryPipelineAction(project.id);
      router.push(`/processing?projectId=${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start regeneration.");
      setRegenerating(false);
    }
  }

  async function regenerateCover() {
    setCoverRegenerating(true);
    try {
      await regenerateCoverAction(project.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start cover regeneration.");
      setCoverRegenerating(false);
    }
  }

  async function saveHook(nextHook: string) {
    const { error } = await supabase
      .from("projects")
      .update({ current_hook: nextHook })
      .eq("id", project.id);
    if (error) toast.error("Couldn't save your hook.");
  }

  async function selectVariation(variation: Variation) {
    setHook(variation.hook);
    setSelectedVariationId(variation.id);
    await supabase
      .from("reel_variations")
      .update({ is_selected: false })
      .eq("project_id", project.id);
    await supabase
      .from("reel_variations")
      .update({ is_selected: true })
      .eq("id", variation.id);
    await supabase
      .from("projects")
      .update({ current_hook: variation.hook })
      .eq("id", project.id);
  }

  async function updateLayout(next: Layout) {
    setLayout(next);
    const { error } = await supabase
      .from("projects")
      .update({ layout: next })
      .eq("id", project.id);
    if (error) toast.error("Couldn't save the layout.");
  }

  async function updateCaption(next: string) {
    setCaption(next);
    const { error } = await supabase
      .from("projects")
      .update({ caption_style: next })
      .eq("id", project.id);
    if (error) toast.error("Couldn't save the caption style.");
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-brand">
            Ready to post
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Your{" "}
            <span className="font-display italic text-gradient-brand">viral reel</span>{" "}
            is ready
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border/60 bg-surface/40" onClick={copyShareLink}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button
            className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
            disabled={downloading === "video"}
            onClick={() =>
              downloadExport(project.output_video_path, "video", `${project.title}.mp4`)
            }
          >
            <Download className="mr-2 h-4 w-4" />
            {downloading === "video" ? "Preparing…" : "Download HD"}
          </Button>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[auto_1fr]">
        {/* Preview */}
        <div className="flex justify-center">
          <div className="rounded-3xl border border-border/60 bg-surface/40 p-8">
            <ReelMockup hook={hook} />
            <div className="mt-4 flex justify-center gap-2">
              <button className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                9:16 · {project.platform}
              </button>
            </div>
          </div>
        </div>

        {/* Panel */}
        <div className="rounded-2xl border border-border/60 bg-surface/40">
          <Tabs defaultValue="video" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b border-border/60 bg-transparent p-0">
              <TabsTrigger value="video" className="rounded-none border-b-2 border-transparent px-5 py-4 data-[state=active]:border-brand data-[state=active]:bg-transparent">
                <Film className="mr-2 h-4 w-4" /> Video
              </TabsTrigger>
              <TabsTrigger value="cover" className="rounded-none border-b-2 border-transparent px-5 py-4 data-[state=active]:border-brand data-[state=active]:bg-transparent">
                <ImageIcon className="mr-2 h-4 w-4" /> Cover
              </TabsTrigger>
              <TabsTrigger value="variations" className="rounded-none border-b-2 border-transparent px-5 py-4 data-[state=active]:border-brand data-[state=active]:bg-transparent">
                <Layers className="mr-2 h-4 w-4" /> Variations
              </TabsTrigger>
              <TabsTrigger value="edit" className="rounded-none border-b-2 border-transparent px-5 py-4 data-[state=active]:border-brand data-[state=active]:bg-transparent">
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="video" className="space-y-4 p-6">
              <div className="grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Hook text
                </label>
                <Input
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                  onBlur={(e) => saveHook(e.target.value)}
                  className="bg-background/40 text-base"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="border-border/60 bg-background/40"
                  disabled={regenerating}
                  onClick={regenerate}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {regenerating ? "Regenerating…" : "Regenerate"}
                </Button>
                <Button variant="outline" className="border-border/60 bg-background/40" onClick={notImplemented}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button
                  className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
                  disabled={downloading === "video"}
                  onClick={() =>
                    downloadExport(project.output_video_path, "video", `${project.title}.mp4`)
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  {downloading === "video" ? "Preparing…" : "Download"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="cover" className="p-6">
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverImageUrl}
                      alt="Cover"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-brand opacity-30" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/60" />
                    </>
                  )}
                  {coverRegenerating && (
                    <div className="absolute inset-0 grid place-items-center bg-black/60 text-xs font-semibold uppercase tracking-widest text-white">
                      Regenerating…
                    </div>
                  )}
                  <div className="absolute inset-x-3 top-4 text-center">
                    <div className="rounded bg-black/60 px-2 py-1 text-xs font-bold uppercase text-white">
                      <span className="bg-gradient-brand bg-clip-text text-transparent">
                        {hook}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    AI-generated cover
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Optimized for CTR. Your face on top of an AI-composed background that
                    matches the topic.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="border-border/60 bg-background/40"
                      disabled={coverRegenerating}
                      onClick={regenerateCover}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {coverRegenerating ? "Regenerating…" : "Regenerate cover"}
                    </Button>
                    <Button
                      className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
                      disabled={downloading === "cover"}
                      onClick={() =>
                        downloadExport(project.cover_image_path, "cover", `${project.title}-cover.png`)
                      }
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {downloading === "cover" ? "Preparing…" : "Download"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="variations" className="p-6">
              <div className="grid gap-4 md:grid-cols-3">
                {variations.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => selectVariation(v)}
                    className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                      selectedVariationId === v.id
                        ? "border-brand/60 bg-brand/5"
                        : "border-border/60 bg-background/40 hover:border-brand/40"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-brand">
                      {v.label} hook
                    </div>
                    <div className="mt-2 text-sm font-semibold">{v.hook}</div>
                    <div className="mt-4 flex justify-center">
                      <ReelMockup compact hook={v.hook} />
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="edit" className="space-y-6 p-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Layout
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {layouts.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => updateLayout(l.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        layout === l.id
                          ? "border-brand/60 bg-brand/5"
                          : "border-border/60 bg-background/40 hover:border-brand/40"
                      }`}
                    >
                      <div className="mb-3 aspect-[9/16] w-16 overflow-hidden rounded-md border border-white/10">
                        {l.id === "top" && (
                          <div className="h-full">
                            <div className="h-1/2 bg-brand/40" />
                            <div className="h-1/2 bg-surface-2" />
                          </div>
                        )}
                        {l.id === "bottom" && (
                          <div className="h-full">
                            <div className="h-1/2 bg-surface-2" />
                            <div className="h-1/2 bg-brand/40" />
                          </div>
                        )}
                        {l.id === "full" && <div className="h-full bg-surface-2" />}
                      </div>
                      <div className="text-sm">{l.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Hook
                </div>
                <div className="mt-3 flex gap-2">
                  <Type className="mt-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={hook}
                    onChange={(e) => setHook(e.target.value)}
                    onBlur={(e) => saveHook(e.target.value)}
                    className="bg-background/40"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Caption style
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {captions.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateCaption(c)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        caption === c
                          ? "border-transparent bg-gradient-brand text-primary-foreground shadow-glow"
                          : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between rounded-2xl border border-border/60 bg-surface/40 p-6">
        <div>
          <div className="text-sm font-semibold">Happy with the result?</div>
          <div className="text-xs text-muted-foreground">
            Save it to your library or make another one.
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="border-border/60 bg-background/40">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button asChild className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95">
            <Link href="/dashboard">Create another</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
