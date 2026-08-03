import { redirect } from "next/navigation";
import { Hero } from "@/components/landing/Hero";
import { ErrorLedger } from "@/components/landing/ErrorLedger";
import { TimeValue } from "@/components/landing/TimeValue";
import { Comparison } from "@/components/landing/Comparison";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhatYouGet } from "@/components/landing/WhatYouGet";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { createClient } from "@/lib/supabase/server";

export default async function Landing() {
  // Someone already signed in has no use for the pitch. Sign-out returns to
  // "/", which renders normally once the session is gone, so no loop.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-background">
      <Hero />
      <ErrorLedger />
      <TimeValue />
      <Comparison />
      <HowItWorks />
      <WhatYouGet />
      <FinalCTA />
    </main>
  );
}
