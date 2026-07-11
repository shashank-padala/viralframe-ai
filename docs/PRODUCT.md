# Product Vision — ViralFrame AI

## The pitch

Creators record one talking-head video. ViralFrame AI turns it into a
scroll-stopping vertical reel with zero manual editing: an AI-selected
b-roll clip on top, the creator's own footage on the bottom, a punchy hook
overlay, and burned-in captions — ready to post to Instagram Reels, TikTok,
and YouTube Shorts.

The wedge is speed and zero skill floor: no timeline, no captioning tool, no
stock footage search. Upload → pick a platform/style → get a finished reel
in about 60 seconds.

## Target user

Solo creators and small teams who already talk to camera (founders,
educators, finance/news commentators, podcasters clipping long-form into
shorts) but don't have an editor and don't want to learn one. The six
starter styles (Business Creator, Podcast, Educational, News Commentary,
Product Marketing, Storytelling) reflect that audience.

## Core loop

1. **Upload** a raw talking-head video (MP4/MOV, up to 2GB).
2. **AI edits everything**: transcript/hook extraction, b-roll selection,
   split-screen composition, caption styling, cover image — target ~60s.
3. **Post everywhere**: download a 9:16 export sized for Reels/TikTok/Shorts.

The results screen lets a creator tweak the AI's choices before export: swap
the hook (3 auto-generated variations — Bold / Curiosity / Controversial),
change the split layout (b-roll top, b-roll bottom, or full-screen video),
and pick a caption style (Hormozi, Minimal, News, Podcast).

## Business model (per the pricing mock)

Freemium: 3 free videos/month with a watermark, a $19/mo Creator tier (HD,
no watermark, all caption styles, AI covers), a $49/mo Pro tier (4K,
priority rendering, brand kit). None of this is enforced yet — see
[ROADMAP.md](./ROADMAP.md).

## What makes this different from a generic video editor

The product is opinionated, not a blank canvas: it makes the b-roll/hook/
caption/layout decisions *for* the creator using AI, and only exposes a
small, high-leverage set of knobs to override afterward. The value is in
good defaults, not flexibility.

## Non-goals (for now)

- Not a general-purpose video editor (no timeline, no arbitrary clip
  trimming/multi-track editing).
- Not for long-form content — output is always a single 9:16 short.
- Not building our own transcription/b-roll/video-gen models — the plan is
  to orchestrate existing AI APIs (see [ROADMAP.md](./ROADMAP.md)).
