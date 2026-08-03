import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
        <div className="flex items-center gap-2 text-sm">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-brand">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          </span>
          <span className="font-medium">ViralFrame AI</span>
          <span className="text-muted-foreground">
            — Captions that get your accent right.
          </span>
        </div>
        <div className="flex gap-6 text-xs text-muted-foreground">
          <span>© 2026</span>
          <a className="hover:text-foreground" href="#">Privacy</a>
          <a className="hover:text-foreground" href="#">Terms</a>
          <a className="hover:text-foreground" href="#">Contact</a>
        </div>
      </div>
    </footer>
  );
}
