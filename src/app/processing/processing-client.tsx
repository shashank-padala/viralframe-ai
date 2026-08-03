"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { retryPipelineAction } from "@/lib/pipeline/actions";
import type { PipelineStage } from "@/lib/supabase/types";

const STAGE_ORDER: PipelineStage[] = [
  "transcribing",
  "writing_hooks",
  "generating_broll",
  "rendering",
  "generating_cover",
];

const STAGE_LABELS: Record<PipelineStage, string> = {
  transcribing: "Understanding your content",
  writing_hooks: "Finding viral moments & generating hooks",
  generating_broll: "Selecting B-roll",
  rendering: "Designing layout & rendering",
  generating_cover: "Creating cover image",
  ready: "Done",
  failed: "Failed",
};

interface ProjectRealtimePayload {
  pipeline_stage: PipelineStage | null;
  error_message: string | null;
  status: string;
}

export function ProcessingClient({
  projectId,
  title,
  initialStage,
  initialError,
}: {
  projectId: string;
  title: string;
  initialStage: PipelineStage | null;
  initialError: string | null;
}) {
  const [stage, setStage] = useState<PipelineStage | null>(initialStage);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [retrying, setRetrying] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const next = payload.new as ProjectRealtimePayload;
          setStage(next.pipeline_stage);
          setErrorMessage(next.error_message);
          if (next.status === "ready") {
            router.push(`/results?projectId=${projectId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, router]);

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryPipelineAction(projectId);
      setErrorMessage(null);
      setStage(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed.");
    } finally {
      setRetrying(false);
    }
  }

  if (stage === "failed") {
    return (
      <div className="relative mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center px-6 py-16">
        <div className="absolute inset-0 bg-hero-wash opacity-60" />
        <div className="relative w-full text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/20">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {errorMessage ?? "Processing failed for an unknown reason."}
          </p>
          <Button
            className="mt-8 bg-gradient-brand text-primary-foreground shadow-elevated hover:opacity-95"
            disabled={retrying}
            onClick={handleRetry}
          >
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </div>
    );
  }

  const currentIndex = stage ? STAGE_ORDER.indexOf(stage) : -1;
  const pct = Math.min(
    100,
    Math.round(((currentIndex + 1) / STAGE_ORDER.length) * 100)
  );

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center px-6 py-16">
      <div className="absolute inset-0 bg-hero-wash opacity-60" />
      <div className="relative w-full text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-brand shadow-elevated">
          <Sparkles className="h-7 w-7 animate-pulse text-primary-foreground" />
        </div>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight md:text-5xl">
          Creating your{" "}
          <span className="font-display italic text-highlight">viral reel</span>…
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{title}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          This can take a few minutes. Don&apos;t refresh the page.
        </p>

        <div className="mt-10 overflow-hidden rounded-full bg-surface">
          <div
            className="h-1.5 bg-gradient-brand transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-10 space-y-3 rounded-2xl border border-border/60 bg-surface/60 p-6 text-left backdrop-blur">
          {STAGE_ORDER.map((s, i) => {
            const done = currentIndex > i;
            const doing = i === currentIndex;
            return (
              <div
                key={s}
                className={`flex items-center gap-3 text-sm transition ${
                  done || doing ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full border ${
                    done
                      ? "border-transparent bg-gradient-brand text-primary-foreground"
                      : doing
                        ? "border-brand/60 bg-brand/10"
                        : "border-border/60"
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : doing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                </span>
                <span>{STAGE_LABELS[s]}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          {currentIndex === -1 ? "Starting…" : "Almost done…"}
        </div>
      </div>
    </div>
  );
}
