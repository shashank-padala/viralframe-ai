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

## Phase 2 — Replace the simulated AI with real AI

This is the actual product. Everything before this phase is scaffolding.

- [ ] **Transcript/script extraction**: speech-to-text on the uploaded
      video (candidate: a hosted Whisper API) to get a transcript to work
      from, instead of just the filename.
- [ ] **Hook generation**: LLM call over the transcript to produce the 3
      hook variations (Bold/Curiosity/Controversial), replacing the string
      templates in `processing-client.tsx`.
- [ ] **B-roll sourcing**: AI video generation only — stock footage was
      evaluated and rejected on quality grounds. `projects.broll_model`
      (added in `0003_add_broll_model.sql`) stores the user's pick of
      `kling` / `runway` / `luma` / `veo`, selectable on the dashboard
      upload form, but no generation call is wired up yet — the field is
      currently write-only. Next step: pick one model to integrate first
      (recommend Kling, it's the default) via a hosted aggregator
      (fal.ai/Replicate) rather than going direct to each vendor's API.
- [ ] **Caption generation + styling**: word-level timestamps (from the STT
      step) burned in per the selected caption style.
- [ ] **Composition/rendering**: the actual split-screen video render (top
      b-roll / bottom creator footage, captions, hook overlay). This needs
      server-side video processing — Vercel Functions have execution-time
      and memory ceilings that make in-process rendering risky for 2GB
      inputs; likely needs a queue + worker (e.g., a container/Fly/Render
      job, or Remotion's render pipeline) rather than a serverless function.
- [ ] **Cover image generation**: image-gen API call composing the
      creator's face over an AI background matching the topic (the results
      page's Cover tab is currently a static mock of this).
- [ ] Wire the Download/Regenerate/Share buttons on the results page to the
      above instead of the placeholder toast.

## Phase 3 — Monetization + growth

- [ ] Enforce the "3 free videos/month" limit (currently just a display
      number computed from `projects` row count — nothing blocks a 4th
      upload).
- [ ] Stripe billing for the Creator ($19) / Pro ($49) tiers from the
      pricing page.
- [ ] Brand kit (Pro tier feature — logo/colors baked into exports).
- [ ] Templates as first-class objects (landing page currently shows 4
      static template cards that all just link to `/dashboard`).
- [ ] Batch mode / podcast-clip mode: one long upload → many short outputs.

## Explicitly out of scope for now

- Multi-track/timeline editing (see [PRODUCT.md](./PRODUCT.md) non-goals).
- Team/multi-seat accounts.
- Native mobile app.
