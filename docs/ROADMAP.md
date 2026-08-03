# Roadmap

Ordered by dependency, not necessarily by calendar priority — later phases
assume earlier ones are solid.

> **Phases 0–3 below are the short-form reel product.** As of 2026-08-02 the
> product direction is long-form captions (see [PRODUCT.md](./PRODUCT.md)),
> so treat them as history plus a list of things that will probably never be
> finished. The live roadmap is the section immediately below.

## Caption product — where the work actually is

### Done

- [x] End-to-end CLI: video in → captioned video out at source resolution
      and frame rate, plus `.srt` and YouTube packaging copy.
- [x] Edit document (`scripts/caption/edl.ts`) as the single intermediate,
      with the source→output time remap isolated in `timeline.ts` so pause
      removal stays tractable.
- [x] Context-aware name/term correction with a consistency sweep.
- [x] DP-based card grouping (dangling cards 10.2% → 5.4% on a real
      transcript).
- [x] Layout-aware 3×3 zone placement from a vision pass.
- [x] Two render engines; libass default at 0.58× playtime vs Remotion's
      8.9×.
- [x] `/editor` — transcript correction, find-and-replace, zone picker,
      re-render.

### Next, in order

1. **Validate before building more.** Put up the diff view — upload a
    video, see side by side what a normal transcriber produced versus what
    the correction pass fixed. It is one ASR call and it is the entire
    sales pitch. Show it to twenty people in the target segment.
2. **Per-user glossary that learns from edits.** Every correction made in
    `/editor` becomes a rule for that user's next video. This is the moat;
    everything else is copyable.
3. **Prime the recogniser** — Deepgram keyword boosting / Whisper initial
    prompt from that glossary, so errors are prevented rather than repaired.
4. **Use the confidence scores we already store** to target the correction
    pass at words the recogniser itself flagged as uncertain.
5. **Chunked parallel encode** — split, encode in parallel, concat. The
    single biggest speed lever, engine-agnostic, no GPU needed.
6. Reconcile the Remotion preview with the libass export (the preview sits
    ~10% of frame height higher, so what you see is not what you get).
7. Only then: pause removal, b-roll, animated explainers.

### Known dead weight

`projects.style` is read by nothing; `projects.platform` only draws a chip
on `/results`. Both are reel leftovers. Remove them when the caption
pipeline is ported into the hosted GitHub Actions workflow.

---

## Phase 0 — UI + backend scaffold (done)

- [x] Port all 6 mock screens (landing, pricing, login, dashboard,
      processing, results) from the Vite/TanStack mock to Next.js.
- [x] Port the design system (colors, gradients, fonts) 1:1.
- [x] shadcn/ui installed and wired.
- [x] Supabase Auth (Google OAuth + email magic link).
- [x] Supabase schema + RLS + storage buckets (`0001_init.sql`).
- [x] Real upload → project row → simulated processing → editable results,
      end to end.
- [x] Route protection via `proxy.ts`.

## Phase 1 — Make Phase 0 actually verified (next up)

Nothing here is architecturally new — it's closing the loop on what's
already built but unverified. Check [`STATUS.md`](../STATUS.md) for the
current checklist state.

- [x] Confirm `0001_init.sql` is applied to the live Supabase project.
- [ ] Enable Google OAuth provider in Supabase Auth settings + register
      redirect URLs (`localhost:3000/auth/callback` and prod once deployed).
- [ ] Do one real end-to-end pass by hand: sign up → upload a real file →
      watch it land in Storage → watch the results page read it back.
- [x] Regenerate `src/lib/supabase/types.ts` from the live schema instead
      of hand-maintaining it.
- [ ] First deploy to Vercel (even just a preview) so the product is
      shareable and Storage/Auth redirect URLs can be finalized for prod.

## Phase 2 — Replace the simulated AI with real AI (built, not yet verified)

This is the actual product. Everything before this phase is scaffolding. All
of the below is now real code in `scripts/pipeline/` + `remotion/`,
orchestrated by `.github/workflows/process-video.yml` (GitHub Actions
runners, not Vercel — chosen for the generous compute/time budget a
fully-autonomous multi-minute render pipeline needs, with zero new infra).
See `docs/ARCHITECTURE.md` for the full request-flow diagram. **Not yet
runtime-verified** — see `STATUS.md` for exactly what's blocking that.

- [x] **Transcript/script extraction**: Deepgram (Nova-3), word-level
      timestamps, stored in `projects.transcript`.
- [x] **Hook generation**: `gpt-5.6-luna` structured-output call over the
      transcript, producing the 3 hook variations (Bold/Curiosity/
      Controversial) in the same call as the b-roll scene prompts below —
      replaces the old string templates in `processing-client.tsx`.
- [x] **B-roll sourcing**: AI video generation only (stock was evaluated and
      rejected on quality grounds). Kling via fal.ai is wired up and is the
      default (`projects.broll_model`); Runway/Luma/Veo remain selectable in
      the UI but throw a clear "not implemented yet" error rather than
      faking success. Per-scene clips tracked in the new `broll_clips`
      table, generated in parallel.
- [x] **Caption generation + styling**: word-level timestamps from the STT
      step drive a rolling-window caption overlay in the Remotion
      composition, with distinct visual styles per `caption_style`
      (Hormozi/Minimal/News/Podcast).
- [x] **Composition/rendering**: Remotion (`@remotion/renderer`,
      self-hosted, no vendor key) compositing creator footage + b-roll +
      captions + hook overlay per the selected layout, rendered inside the
      GitHub Actions runner itself (a full Linux VM, not a serverless
      function — sidesteps the execution-time/memory ceilings a Vercel
      Function would hit on 2GB inputs).
- [x] **Cover image generation**: a frame is extracted from the creator's
      own video via ffmpeg, then composited over an AI-generated background
      via Grok Imagine's edit endpoint (`xai/grok-imagine-image/edit`, through
      fal.ai -- same provider as b-roll, no separate key needed). Chosen over
      OpenAI's `gpt-image-1` after checking that fal.ai also hosts Google's
      Nano Banana models, which have documented reference-image identity
      consistency; Grok was picked on direct observed thumbnail quality with
      the tradeoff flagged (no documented face-preservation claim either way)
      and an easy one-line fallback to `nano-banana-pro/edit` if real-video
      testing shows face fidelity issues.
- [x] Download/Regenerate/Share buttons on the results page wired to real
      data (signed Storage URLs, workflow re-dispatch, clipboard copy) —
      only the ambiguous/redundant "Edit" button next to Regenerate is still
      a no-op toast.
- [x] Real per-stage progress on the processing screen via a Supabase
      Realtime subscription on `projects.pipeline_stage`, replacing the old
      fake `setTimeout` animation. Failures surface `error_message` with a
      retry button instead of hanging silently.

## Phase 3 — Monetization + growth

- [x] Enforce the "3 free videos/month" limit — a Postgres trigger
      (`enforce_free_tier_upload_limit`) blocks a 4th free-tier upload
      server-side, plus a client-side pre-check to avoid wasting an upload
      that would just get rejected.
- [ ] Stripe billing for the Creator ($19) / Pro ($49) tiers from the
      pricing page — there's a free-tier cap now, but still no way to
      actually become a paying user.
- [x] Scoped cover regeneration — a real test showed Kling is ~97% of
      per-video cost (~$1.40 of ~$1.43 for a 1-min video), so "Regenerate
      cover" now dispatches the workflow with `mode=cover_only`, skipping
      transcript/hooks/b-roll entirely instead of re-running everything.
      "Regenerate" (Video tab, full pipeline) is unchanged.
- [ ] Wire up Runway/Luma/Veo b-roll generation (only Kling is implemented).
- [ ] Brand kit (Pro tier feature — logo/colors baked into exports).
- [ ] Templates as first-class objects (landing page currently shows 4
      static template cards that all just link to `/dashboard`).
- [ ] Batch mode / podcast-clip mode: one long upload → many short outputs.

## Explicitly out of scope for now

- Multi-track/timeline editing (see [PRODUCT.md](./PRODUCT.md) non-goals).
- Team/multi-seat accounts.
- Native mobile app.
