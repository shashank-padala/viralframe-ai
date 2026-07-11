"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const steps = [
  "Understanding your content",
  "Finding viral moments",
  "Generating hook",
  "Selecting B-roll",
  "Designing layout",
  "Creating cover image",
];

function buildVariations(title: string) {
  const topic = title.toLowerCase();
  return [
    { label: "Bold", hook: title.toUpperCase() },
    { label: "Curiosity", hook: `Why ${topic} matters more than you think` },
    { label: "Controversial", hook: `The truth about ${topic} nobody tells you` },
  ];
}

export function ProcessingClient({
  projectId,
  title,
}: {
  projectId: string;
  title: string;
}) {
  const [active, setActive] = useState(0);
  const router = useRouter();
  const finalized = useRef(false);

  useEffect(() => {
    if (active < steps.length) {
      const t = setTimeout(() => setActive((a) => a + 1), 900);
      return () => clearTimeout(t);
    }

    if (finalized.current) return;
    finalized.current = true;

    (async () => {
      const supabase = createClient();
      const variations = buildVariations(title);

      const { error: variationsError } = await supabase
        .from("reel_variations")
        .insert(
          variations.map((v, i) => ({
            project_id: projectId,
            label: v.label,
            hook: v.hook,
            is_selected: i === 0,
          }))
        );

      const { error: updateError } = await supabase
        .from("projects")
        .update({ status: "ready", current_hook: variations[0].hook })
        .eq("id", projectId);

      if (variationsError || updateError) {
        toast.error("Something went wrong finishing your reel.");
      }

      const t = setTimeout(
        () => router.push(`/results?projectId=${projectId}`),
        400
      );
      return () => clearTimeout(t);
    })();
  }, [active, projectId, title, router]);

  const pct = Math.min(100, Math.round((active / steps.length) * 100));

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center px-6 py-16">
      <div className="absolute inset-0 bg-hero-glow opacity-60" />
      <div className="relative w-full text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
          <Sparkles className="h-7 w-7 animate-pulse text-primary-foreground" />
        </div>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight md:text-5xl">
          Creating your{" "}
          <span className="font-display italic text-gradient-brand">viral reel</span>…
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This usually takes about 60 seconds. Don&apos;t refresh the page.
        </p>

        <div className="mt-10 overflow-hidden rounded-full bg-surface">
          <div
            className="h-1.5 bg-gradient-brand transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-10 space-y-3 rounded-2xl border border-border/60 bg-surface/60 p-6 text-left backdrop-blur">
          {steps.map((s, i) => {
            const done = i < active;
            const doing = i === active;
            return (
              <div
                key={s}
                className={`flex items-center gap-3 text-sm transition ${
                  done ? "text-foreground" : doing ? "text-foreground" : "text-muted-foreground"
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
                <span>{s}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-xs text-muted-foreground">Almost done…</div>
      </div>
    </div>
  );
}
