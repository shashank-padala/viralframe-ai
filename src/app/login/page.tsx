import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { LoginForm } from "./login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in — ViralFrame",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(redirectTo ?? "/dashboard");

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-hero-wash" />
      <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-border/60 bg-surface/80 p-8 shadow-card backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand shadow-elevated">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="text-sm font-semibold tracking-tight">ViralFrame AI</span>
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">
          Welcome back.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to caption your next video.
        </p>

        <LoginForm redirectTo={redirectTo ?? "/dashboard"} />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
