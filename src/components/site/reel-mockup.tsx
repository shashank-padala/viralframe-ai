import { Play, Volume2, Heart, MessageCircle, Send, Bookmark } from "lucide-react";

type Props = {
  hook?: string;
  handle?: string;
  broll?: string;
  face?: string;
  caption?: string;
  compact?: boolean;
};

export function ReelMockup({
  hook = "India's biggest EV mistake",
  handle = "@creator",
  broll = "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=70",
  face = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=70",
  caption = "battery • lithium • india",
  compact = false,
}: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-card ${
        compact ? "aspect-[9/16] w-[220px]" : "aspect-[9/16] w-[300px]"
      }`}
    >
      {/* B-roll top */}
      <div className="relative h-1/2 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={broll} alt="B-roll" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />
        <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur">
          AI B-ROLL
        </div>
      </div>
      {/* Creator bottom */}
      <div className="relative h-1/2 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={face} alt="Creator" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Hook overlay */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4">
        <div className="mx-auto max-w-[260px] rounded-xl bg-black/70 px-3 py-2 text-center text-[15px] font-bold uppercase leading-tight tracking-tight text-white shadow-[0_0_0_2px_rgba(255,255,255,0.08)]">
          <span className="bg-gradient-brand bg-clip-text text-transparent">{hook}</span>
        </div>
      </div>

      {/* Caption bar */}
      <div className="absolute inset-x-0 bottom-16 px-4">
        <div className="rounded-md bg-black/60 px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
          {caption}
        </div>
      </div>

      {/* IG chrome */}
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-white/90">
        <div className="text-[11px] font-medium">{handle}</div>
        <div className="flex items-center gap-2">
          <Volume2 className="h-3.5 w-3.5" />
          <Play className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="pointer-events-none absolute right-2 top-1/3 flex flex-col items-center gap-3 text-white/90">
        <Heart className="h-4 w-4" />
        <MessageCircle className="h-4 w-4" />
        <Send className="h-4 w-4" />
        <Bookmark className="h-4 w-4" />
      </div>
    </div>
  );
}
