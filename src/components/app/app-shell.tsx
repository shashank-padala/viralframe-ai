import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/supabase/actions";
import { SideNav, type NavItem } from "./side-nav";

// Shell for the signed-in application (dashboard, reel flow, caption
// editor). The marketing pages keep the wide top nav in components/site;
// this one trades that for a rail so the editor keeps its width.

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const items: NavItem[] = [{ href: "/dashboard", label: "Reels", icon: "dashboard" }];

  // The editor reads and writes local files and throws outside development,
  // so linking to it in production would advertise a route that errors.
  if (process.env.NODE_ENV !== "production") {
    items.push({ href: "/editor", label: "Captions", icon: "captions", badge: "local" });
  }

  items.push({ href: "/pricing", label: "Pricing", icon: "pricing" });

  return (
    // `dark` is scoped here rather than on <html>: the marketing pages are
    // light, and the app is dark because judging video against bright chrome
    // is measurably harder -- which is why every video editor ships dark.
    <div className="dark flex min-h-screen bg-background text-foreground">
      <SideNav
        items={items}
        footer={
          user ? (
            <div className="flex items-center gap-2">
              <span
                className="hidden min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground lg:inline"
                title={user.email}
              >
                {user.email}
              </span>
              <form action={signOutAction}>
                <Button variant="ghost" size="sm" type="submit" title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : null
        }
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
