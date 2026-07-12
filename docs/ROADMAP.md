# Roadmap

Ordered by dependency, not necessarily by calendar priority — later phases
assume earlier ones are solid.

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
- [x] **Hook generation**: `gpt-5.4-nano` structured-output call over the
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
      via OpenAI's `gpt-image-1` image-edit endpoint.
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
- [ ] Scoped regeneration — Regenerate currently re-runs the whole pipeline
      even for just a new cover image; fine for v1, wasteful at scale.
- [ ] Wire up Runway/Luma/Veo b-roll generation (only Kling is implemented).
- [ ] Brand kit (Pro tier feature — logo/colors baked into exports).
- [ ] Templates as first-class objects (landing page currently shows 4
      static template cards that all just link to `/dashboard`).
- [ ] Batch mode / podcast-clip mode: one long upload → many short outputs.

## Explicitly out of scope for now

- Multi-track/timeline editing (see [PRODUCT.md](./PRODUCT.md) non-goals).
- Team/multi-seat accounts.
- Native mobile app.
