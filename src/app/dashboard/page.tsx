import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard — ViralFrame",
};

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, current_hook, status, created_at")
    .order("created_at", { ascending: false })
    .limit(4);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const { count: usedThisMonth } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfMonth.toISOString());

  const remaining = Math.max(0, 3 - (usedThisMonth ?? 0));

  return (
    <AppShell>
      <DashboardClient
        userId={user.id}
        history={projects ?? []}
        remainingFreeVideos={remaining}
        plan={profile?.plan ?? "free"}
      />
    </AppShell>
  );
}
