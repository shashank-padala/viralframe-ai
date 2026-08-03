"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, LayoutDashboard, Sparkles, Type } from "lucide-react";

// Icon rail rather than a full sidebar: the caption editor needs almost all
// the horizontal space it can get for the transcript, so navigation collapses
// to 64px and only shows labels once there is room for both.

export interface NavItem {
  href: string;
  label: string;
  icon: "dashboard" | "captions" | "pricing";
  /** Shown next to the label — used to mark the dev-only editor. */
  badge?: string;
}

const ICONS = {
  dashboard: LayoutDashboard,
  captions: Type,
  pricing: CreditCard,
};

export function SideNav({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-border/60 bg-surface/30 lg:w-56">
      <Link href="/" className="flex h-16 items-center gap-2 px-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-brand shadow-glow">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </span>
        <span className="hidden text-[15px] font-semibold tracking-tight lg:inline">
          ViralFrame <span className="text-muted-foreground">AI</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          // startsWith so /results and /processing keep the reel entry lit
          // while you are inside that flow.
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-brand/10 text-foreground"
                  : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden flex-1 lg:inline">{item.label}</span>
              {item.badge && (
                <span className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground lg:inline">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {footer && <div className="border-t border-border/60 p-2">{footer}</div>}
    </aside>
  );
}
