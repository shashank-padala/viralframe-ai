# Status

_Last updated: 2026-07-12_

Read this first in a new session. For the "why", see `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`.

## Where things stand

The app is a working Next.js port of the `~/reel-magic-ai-40` mock, wired to
a real Supabase project (`oqqfejxdewevfxnjblsi`), with a **real AI pipeline
now built** (Phase 2 from `docs/ROADMAP.md`) — code-complete but not yet
runtime-verified end to end because it needs third-party API keys nobody has
supplied yet (see "NOT yet verified" below). Nothing here fakes success:
every stage either does the real thing or fails loudly with `error_message`
set on the project row.

Auth, upload, and all results-page edits are real, same as before. What
changed: transcript extraction, hook generation, b-roll generation,
composition/rendering, and cover image generation are all real code paths
now, orchestrated by a GitHub Actions workflow instead of the old
`setTimeout` animation. See `docs/ARCHITECTURE.md` for the full pipeline
diagram.

Build (`npm run build`) and lint (`npm run lint`) are clean as of this
writing. `npx tsc --noEmit` is clean including `scripts/pipeline/` and
`remotion/`. The Remotion composition bundles and resolves correctly
(verified locally — see "Verified this session"); nothing has been rendered
against a real video yet.

Repo is on GitHub (private): `shashank-padala/viralframe-ai`.

## Verified this session

- [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` all pass clean
      across the whole repo, including `scripts/pipeline/` and `remotion/`.
- [x] Migrations `0004_pipeline_state`, `0005_enable_realtime`,
      `0006_free_tier_limit` all applied to the live Supabase project (on
      top of `0001`–`0003` from earlier). No new security advisories beyond
      the pre-existing platform-internal `rls_auto_enable` warning.
- [x] `broll_clips` table + `projects.pipeline_stage`/`error_message`/
      `transcript` columns exist live, confirmed via `mcp__supabase__list_tables`.
- [x] `projects` is now in the `supabase_realtime` publication (was empty
      before — `postgres_changes` subscriptions would have silently done
      nothing without this).
- [x] Free-tier limit is enforced by a Postgres trigger
      (`enforce_free_tier_upload_limit`, `SECURITY DEFINER`, locked down
      like `handle_new_user`) — not just a client-side check, so it can't be
      bypassed by calling the Supabase client directly.
- [x] `scripts/pipeline/run.ts` resolves all imports correctly under `tsx`
      (including the `@/` path alias) and fails exactly where expected when
      given a fake project ID / fake service-role key — confirms the
      Supabase admin client wiring is correct.
- [x] The Remotion composition (`remotion/`) bundles cleanly and
      `selectComposition` resolves duration/dimensions correctly from
      `calculateMetadata` (1080×1920 @ 30fps, verified with sample props).
- [x] fal.ai's queue API shape (submit/status/result endpoints) and
      OpenAI's Structured Outputs / Images edit endpoint shapes were verified
      against current docs before writing the integration code, not assumed
      from training data.

## NOT yet verified — blocked on prerequisites, do these first next session

1. **No third-party API keys are configured yet.** `scripts/pipeline/` is
   code-complete but every external call (Deepgram, OpenAI, fal.ai) will
   fail loudly until these are set — see `.env.local.example` for the full
   list (`DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `FAL_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`). None of these should ever get the
   `NEXT_PUBLIC_` prefix.
2. **GitHub Actions isn't wired up yet.** `.github/workflows/process-video.yml`
   exists but (a) the repo secrets it reads
   (`SUPABASE_SERVICE_ROLE_KEY`/`DEEPGRAM_API_KEY`/`OPENAI_API_KEY`/`FAL_KEY`,
   plus `NEXT_PUBLIC_SUPABASE_URL`) haven't been set on the GitHub repo, and
   (b) it's never been triggered — `gh workflow run process-video.yml -f
   project_id=<id>` is the fastest way to test it once secrets are in.
3. **The app can't dispatch the workflow yet either.** `dispatchPipelineAction`
   (`src/lib/pipeline/actions.ts`) needs `GITHUB_ACTIONS_TOKEN` (a
   fine-grained PAT scoped to this repo, `actions: write`),
   `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME` set as env vars **on Vercel**
   (production + preview) — not just locally.
4. **Is Google OAuth enabled?** Still open from before — Dashboard/
   Management-API only, no MCP tool covers this. See supabase.com/dashboard
   → Authentication → Providers.
5. **Full manual click-through with a real file, end to end**: upload → real
   transcript lands in `projects.transcript` → real (non-templated) hooks in
   `reel_variations` → real b-roll clips in `broll_clips` → a real playable
   MP4 at `output_video_path` → a real cover image → Download/Regenerate on
   the results page actually work. Nothing in this chain has touched a real
   video file yet.

## Known gaps (not bugs, just unbuilt — see docs/ROADMAP.md Phase 3)

- Runway/Luma/Veo b-roll models are selectable in the UI but throw a clear
  "not implemented yet" error if picked — only Kling (the default) is wired
  up to fal.ai.
- The results page "Edit" button (next to Regenerate/Download on the Video
  tab) is still a no-op toast — redundant with the hook `Input` right above
  it, left alone rather than guessing what it should do.
- "Regenerate" (video or cover) re-runs the *entire* pipeline, not just the
  affected stage — acceptable for v1 per the plan, real cost/latency
  overhead if someone just wants a new cover.
- No billing (Stripe or otherwise) — pricing tiers are static marketing
  copy. The free-tier *count* is now enforced (3/month), but there's no way
  to actually become a paying user yet.
- Not deployed anywhere yet — no Vercel project linked.

## Immediate next steps, in order

1. Get the four API keys (Deepgram, OpenAI, fal.ai) + create the GitHub
   fine-grained PAT, set them as GitHub repo secrets.
2. `gh workflow run process-video.yml -f project_id=<a real project id>` —
   watch it run against one real uploaded video, fix whatever breaks first
   (most likely candidate: Remotion's Chromium deps on the GitHub-hosted
   runner, or fal.ai's exact response shape drifting from what was verified
   against docs).
3. Once the workflow runs clean standalone, set `GITHUB_ACTIONS_TOKEN` /
   `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` on Vercel and do the first
   deploy, then do the full click-through from the browser.
4. Enable Google OAuth in Supabase Auth settings (unrelated, still open).
5. Then Phase 3 (`docs/ROADMAP.md`) — Stripe billing, Runway/Luma/Veo,
   scoped regeneration instead of whole-pipeline reruns.
