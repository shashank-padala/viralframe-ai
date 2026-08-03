# Product Vision — ViralFrame AI

> **Current direction (2026-08-02): captions for long-form video.**
> Everything below the "Original direction" heading describes the
> short-form reel product this repo started as. It is still the code that
> `/dashboard` and `/results` drive, but it is no longer where the product
> is going. Read this section first.

## The pitch

Creators upload a long-form landscape video. It comes back captioned in the
CapCut/Hormozi style — 3-4 word cards, one word emphasised, placed where
they do not cover the speaker's face or the content on screen — plus a
subtitle sidecar and YouTube packaging copy. No timeline, no editing.

## The wedge: accented, non-native English

The differentiator is not "we make captions". Everyone makes captions, and
CapCut gives them away unlimited at $19/month.

The differentiator is **captions you do not have to proofread.** Speech
recognition is materially worse on accented, non-native English, so for a
large population of creators every existing tool produces something they
must hand-fix. Unlimited quantity does not solve a quality problem.

So the pipeline runs a context-aware correction pass over the whole
transcript before captions are cut, fixing misheard product names, company
names, homophones and number formatting — the class of error that a human
fixes trivially by reading the surrounding sentence, and that an acoustic
model structurally cannot, because the information is not in the sound.

**Faithful, never polished.** Corrections fix what the recogniser got
wrong. They never fix grammar, remove filler, or tidy false starts — a
burned-in caption is read while the speaker's voice is audible, so any
divergence reads as broken, and silently "correcting" a non-native
speaker's English is a different proposition from fixing a machine's
mistake. See `scripts/caption/plan/correct.ts`.

## Target user

Creators whose content is full of names the recogniser mangles — tech,
finance, education commentary — and especially those speaking accented
English. Secondarily the people who edit for them: podcast editors, course
producers, agencies, who feel the proofreading cost on every deliverable.

## The intended moat

Not "we correct better" — base models improve and that erodes. The durable
asset is a **per-user glossary that learns from edits**: every correction
made in `/editor` becomes a rule for that user's next video. Their tenth
video is far better than their first, and none of that transfers to a
competitor. This is the agreed next thing to build.

## Discipline

Do one thing better than anyone else. Pause removal, b-roll and animated
explainers are all things CapCut already does well; adding them before
captions are unambiguously best-in-class just makes a worse CapCut.

---

# Original direction — short-form reels

_Kept for context. This is what `/dashboard`, `/processing` and `/results`
still implement, and what the `scripts/pipeline/` + Kling b-roll code was
built for._

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
