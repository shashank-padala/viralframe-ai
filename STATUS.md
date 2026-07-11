# Status

_Last updated: 2026-07-11_

Read this first in a new session. For the "why", see `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`.

## Where things stand

The app is a working Next.js port of the `~/reel-magic-ai-40` mock, wired to
a real Supabase project (`oqqfejxdewevfxnjblsi`). Auth, upload, and all
results-page edits are real. The AI processing step is simulated (scripted
animation + templated hook text, no real transcript/b-roll/rendering). See
`docs/ARCHITECTURE.md` → "What's real vs simulated" for the exact line.

Build (`npm run build`) and lint (`npm run lint`) are clean as of this
writing. Dev server has been smoke-tested with the real project's
credentials — no Supabase client errors, route protection redirects work.

## Verified this session

- [x] `npm run build` and `npm run lint` pass clean.
- [x] All 6 routes return the expected status (200 for public, 307→/login
      for protected) against the real Supabase project.
- [x] Compiled CSS contains the ported brand tokens (fonts, gradients).
- [x] `.env.local` exists locally with real credentials (gitignored, not
      committed — see `.env.local.example` for the shape).

## NOT yet verified — do these first next session

1. **Is the migration actually applied?** `supabase/migrations/0001_init.sql`
   was written and reviewed but never confirmed run against the live
   project. Until this is confirmed, assume `projects`/`reel_variations`/
   storage buckets may not exist yet, which would make dashboard upload and
   the results page fail at runtime even though auth works.
   → Check via Supabase MCP (see below) or the Supabase SQL Editor /
   Table Editor directly.
2. **Is Google OAuth enabled?** The login page calls
   `supabase.auth.signInWithOAuth({ provider: "google" })`, but the Google
   provider has to be turned on in Supabase Auth settings with a redirect
   URL registered (`http://localhost:3000/auth/callback` for local dev).
   Email magic link is on by default and needs no extra setup.
3. **Full manual click-through**: sign up → land on dashboard → drop a real
   video file → confirm it appears in the `source-videos` bucket → confirm
   a `projects` row was created → let the fake processing step finish →
   confirm `reel_variations` rows exist and the results page reads them →
   edit the hook/layout/caption and confirm it persists on reload. This has
   not been done end-to-end with a real file; only individual pieces have
   been checked in isolation.
4. **Supabase MCP not yet connected this session.** `.mcp.json` has a
   project-scoped Supabase MCP server registered
   (`https://mcp.supabase.com/mcp?project_ref=oqqfejxdewevfxnjblsi`), but
   MCP servers only connect at session start — it wasn't live in the
   session that added it. Restart Claude Code in this directory, then it
   should be usable for #1 above instead of guessing.

## Known gaps (not bugs, just unbuilt — see docs/ROADMAP.md Phase 2)

- No real transcript extraction, hook-generation LLM call, b-roll sourcing,
  caption burn-in, or video rendering pipeline. The results page's
  Download/Regenerate/Share buttons intentionally show a "not wired up yet"
  toast rather than faking success.
- "3 free videos/month" is a display-only number, not enforced.
- No billing (Stripe or otherwise) — pricing tiers are static marketing copy.
- Not deployed anywhere yet — no Vercel project linked, no git remote.
- `src/lib/supabase/types.ts` is hand-written, not generated from the
  live schema — could drift if the migration changes without updating it.

## Immediate next steps, in order

1. Restart the session so the Supabase MCP connects.
2. Use it to confirm/apply `supabase/migrations/0001_init.sql`.
3. Enable Google OAuth in Supabase Auth settings.
4. Do the full manual click-through in item 3 above.
5. Once confirmed working, do the first Vercel deploy (`/vercel:deploy` or
   the Vercel MCP) so there's a shareable preview link.
6. Then start Phase 2 (real AI pipeline) per `docs/ROADMAP.md` — starting
   with picking the transcript/STT provider, since everything else in that
   phase depends on having a transcript.
