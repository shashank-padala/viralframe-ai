import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/supabase/actions";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand shadow-elevated">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            ViralFrame <span className="text-muted-foreground">AI</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="/#examples" className="hover:text-foreground">Examples</Link>
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
              <form action={signOutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" className="bg-gradient-brand text-primary-foreground shadow-elevated hover:opacity-95" asChild>
                <Link href="/dashboard">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
