"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [googlePending, setGooglePending] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const callbackUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(redirectTo)}`;

  async function handleGoogleSignIn() {
    setGooglePending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (error) {
      toast.error(error.message);
      setGooglePending(false);
    }
    // On success the browser is redirected to Google, so no further action here.
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setEmailPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    setEmailPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <div className="mt-8 rounded-xl border border-brand/40 bg-brand/5 px-4 py-6 text-center">
        <div className="text-sm font-semibold">Check your email</div>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a sign-in link to {email}.
        </p>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={handleGoogleSignIn}
        disabled={googlePending}
        className="mt-8 w-full bg-white text-black hover:bg-white/90"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.5 2.4 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.1 17.7 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/>
          <path fill="#FBBC05" d="M10.5 28.6c-.6-1.8-.9-3.7-.9-5.6s.3-3.8.9-5.6l-7.9-6.1C.9 15 0 19.4 0 24s.9 9 2.6 12.7l7.9-8.1z"/>
          <path fill="#34A853" d="M24 48c6.1 0 11.2-2 15-5.5l-7.6-5.9c-2.1 1.4-4.8 2.3-7.4 2.3-6.3 0-11.6-3.6-13.5-9.4l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
        </svg>
        {googlePending ? "Redirecting…" : "Continue with Google"}
      </Button>

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-3" onSubmit={handleEmailSignIn}>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder="you@creator.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-background/40 pl-10"
          />
        </div>
        <Button
          type="submit"
          disabled={emailPending}
          className="w-full bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
        >
          {emailPending ? "Sending link…" : "Sign in with email"}
        </Button>
      </form>
    </>
  );
}
