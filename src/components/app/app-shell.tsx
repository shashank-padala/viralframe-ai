import { LogOut } from "lucide-react";
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
    <div className="flex min-h-screen bg-background text-foreground">
      <SideNav
        items={items}
        footer={
          user ? (
            <div className="space-y-1">
              <div
                className="hidden truncate px-3 pb-1 pt-1 text-[11px] text-muted-foreground lg:block"
                title={user.email}
              >
                {user.email}
              </div>
              <form action={signOutAction}>
                {/* Styled to match the nav items above rather than as a
                    button, so the rail reads as one list and the collapsed
                    state stays icon-aligned. */}
                <button
                  type="submit"
                  title="Sign out"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="hidden lg:inline">Sign out</span>
                </button>
              </form>
            </div>
          ) : null
        }
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
