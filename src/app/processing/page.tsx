import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Nav } from "@/components/site/nav";
import { createClient } from "@/lib/supabase/server";
import { ProcessingClient } from "./processing-client";

export const metadata: Metadata = {
  title: "Creating your reel — ViralFrame AI",
};

export default async function Processing({
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
    .select("id, title, status, pipeline_stage, error_message")
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/dashboard");
  }

  if (project.status === "ready") {
    redirect(`/results?projectId=${projectId}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <ProcessingClient
        projectId={project.id}
        title={project.title}
        initialStage={project.pipeline_stage}
        initialError={project.error_message}
      />
    </div>
  );
}
