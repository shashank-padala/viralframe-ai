import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";
import { ResultsClient } from "./results-client";

export const metadata: Metadata = {
  title: "Your reel is ready — ViralFrame AI",
};

export default async function Results({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;

  if (!projectId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/dashboard");
  }

  if (project.status === "processing" || project.status === "uploaded") {
    redirect(`/processing?projectId=${projectId}`);
  }

  const { data: variations } = await supabase
    .from("reel_variations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  return (
    <AppShell>
      <ResultsClient project={project} variations={variations ?? []} />
    </AppShell>
  );
}
