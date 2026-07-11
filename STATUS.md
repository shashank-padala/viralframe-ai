# Status

_Last updated: 2026-07-11_

Read this first in a new session. For the "why", see `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`.

## Where things stand

The app is a working Next.js port of the `~/reel-magic-ai-40` mock, wired to
a real Supabase project (`oqqfejxdewevfxnjblsi`). The schema is now applied
to that project. Auth, upload, and all results-page edits are real. The AI
processing step is simulated (scripted animation + templated hook text, no
real transcript/b-roll/rendering). See `docs/ARCHITECTURE.md` → "What's real
vs simulated" for the exact line.

Build (`npm run build`) and lint (`npm run lint`) are clean as of this
writing. Dev server has been smoke-tested with the real project's
credentials — no Supabase client errors, route protection redirects work.

Repo is now on GitHub (private): `shashank-padala/viralframe-ai`.

## Verified this session

- [x] `npm run build` and `npm run lint` pass clean.
- [x] All 6 routes return the expected status (200 for public, 307→/login
      for protected) against the real Supabase project.
- [x] Compiled CSS contains the ported brand tokens (fonts, gradients).
- [x] `.env.local` exists locally with real credentials (gitignored, not
      committed — see `.env.local.example` for the shape), and matches the
      live project's URL/publishable key exactly (checked via Supabase MCP).
- [x] **Migration applied.** `supabase/migrations/0001_init.sql` is live on
      the project — `profiles`, `projects`, `reel_variations` all exist with
      RLS enabled, plus the `source-videos`/`reel-exports` storage buckets.
      Confirmed via `mcp__supabase__list_tables`.
- [x] Fixed a security advisory from the migration: `handle_new_user()` was
      publicly callable via REST RPC as a `SECURITY DEFINER` function.
      Revoked `EXECUTE` from `public`/`anon`/`authenticated` in a follow-up
      migration (`0002_lock_down_handle_new_user`) — it still fires via the
      `on_auth_user_created` trigger, just isn't directly callable anymore.
- [x] `src/lib/supabase/types.ts` regenerated from the live schema via
      `mcp__supabase__generate_typescript_types` (kept the hand-written
      `Platform`/`ProjectStatus`/`Layout` literal unions layered on top,
      since app code imports them and the generated output only has
      `string`).

## NOT yet verified — do these first next session

1. **Is Google OAuth enabled?** The login page calls
   `supabase.auth.signInWithOAuth({ provider: "google" })`, but the Google
   provider has to be turned on in Supabase Auth settings with a redirect
   URL registered (`http://localhost:3000/auth/callback` for local dev).
   Email magic link is on by default and needs no extra setup. No MCP tool
   here can toggle this (it's Dashboard/Management-API only) — must be done
   by hand at supabase.com/dashboard → Authentication → Providers.
2. **Full manual click-through with a real file**: sign up → land on
   dashboard → drop a real video file → confirm it appears in the
   `source-videos` bucket → confirm a `projects` row was created → let the
   fake processing step finish → confirm `reel_variations` rows exist and
   the results page reads them → edit the hook/layout/caption and confirm it
   persists on reload. Tables/buckets now exist so this should work, but it
   hasn't been driven end-to-end with a real file yet — only route-level
   smoke tests (curl status codes) have been done.

## Known gaps (not bugs, just unbuilt — see docs/ROADMAP.md Phase 2)

- No real transcript extraction, hook-generation LLM call, b-roll
  generation, caption burn-in, or video rendering pipeline. The results
  page's Download/Regenerate/Share buttons intentionally show a "not wired
  up yet" toast rather than faking success.
- B-roll model choice (Kling/Runway/Luma/Veo) is selectable on the
  dashboard and persisted to `projects.broll_model`, but nothing reads that
  column yet — no generation API is actually called.
- "3 free videos/month" is a display-only number, not enforced.
- No billing (Stripe or otherwise) — pricing tiers are static marketing copy.
- Not deployed anywhere yet — no Vercel project linked.

## Immediate next steps, in order

1. Enable Google OAuth in Supabase Auth settings (manual, dashboard-only).
2. Do the full manual click-through in item 2 above with a real video file.
3. Once confirmed working, do the first Vercel deploy (`/vercel:deploy` or
   the Vercel MCP) so there's a shareable preview link.
4. Then start Phase 2 (real AI pipeline) per `docs/ROADMAP.md` — starting
   with picking the transcript/STT provider, since everything else in that
   phase depends on having a transcript.
