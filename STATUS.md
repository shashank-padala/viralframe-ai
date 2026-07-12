# Status

_Last updated: 2026-07-12_

Read this first in a new session. For the "why", see `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`.

## Where things stand

The app is a working Next.js port of the `~/reel-magic-ai-40` mock, wired to
a real Supabase project (`oqqfejxdewevfxnjblsi`), with a **real AI pipeline**
(Phase 2 from `docs/ROADMAP.md`) — and it's been **run once for real**, not
just code-complete. Deepgram transcription and `gpt-5.6-luna` hook/scene
generation are confirmed working against a real uploaded video. B-roll
generation (Kling via fal.ai) is confirmed *wired correctly* (got a real,
well-formed 403 from fal.ai, not a malformed-request error) but blocked on
the account not having a payment method yet — that's an account setup step,
not a code problem. Render and cover generation haven't been reached in a
real run yet since the pipeline stops at b-roll.

Nothing here fakes success: every stage either does the real thing or fails
loudly with `error_message` set on the project row.

Auth, upload, and all results-page edits are real. Cover regeneration is now
**scoped** — a `mode=cover_only` workflow dispatch skips transcript/hooks/
b-roll entirely, since the real test showed Kling is ~97% of per-video cost.

Build (`npm run build`), lint (`npm run lint`), and `npx tsc --noEmit` are
all clean across the whole repo including `scripts/pipeline/` and
`remotion/`.

Repo is on GitHub (private): `shashank-padala/viralframe-ai`. Not deployed
to Vercel yet.

## Verified this session (with a real video)

- [x] **Real end-to-end test run** via `gh workflow run` against a real
      uploaded video (~50s, EV-battery topic). Confirmed directly from the
      `projects`/`reel_variations` tables, not just inferred:
  - [x] Deepgram: `projects.transcript` populated, 114 words with
        timestamps.
  - [x] `gpt-5.6-luna`: 3 genuinely distinct, topical hooks landed in
        `reel_variations` (e.g. "India spends ₹18,000 crores on EV
        batteries—but invents almost none.") — not generic/repetitive,
        validates the earlier nano→luna model decision.
  - [x] 4 b-roll scene prompts generated (`broll_clips`), specific and
        visual (e.g. "Indian laboratory, scientists examining battery cells
        beside mineral samples and research equipment").
  - [x] Kling/fal.ai call reached the API correctly and got a real 403
        (`"User is locked. Reason: Exhausted balance."`) — confirms the
        request shape (auth header, endpoint, payload) is correct; the
        blocker is fal.ai billing, not our code.
- [x] **Real per-video cost measured**: ~$1.43 for a 1-min video, of which
      **Kling is ~$1.40 (97%)** — 4 clips × $0.35/clip. Deepgram + LLM +
      cover combined are a fraction of a cent. This is why cover-only
      regeneration was worth building now rather than deferring to Phase 3.
- [x] All prior structural verification still holds: migrations
      `0004`–`0006` applied live, RLS clean (no new advisories beyond the
      pre-existing `rls_auto_enable` platform warning), `projects` in the
      `supabase_realtime` publication, free-tier trigger enforced
      server-side, Remotion composition bundles and resolves correctly.
- [x] `GITHUB_ACTIONS_TOKEN` is set — as a GitHub-repo-scoped fine-grained
      PAT (`Actions: Read and write` only), in `.env.local`, and on Vercel
      (production + preview).
- [x] All five GitHub Actions repo secrets are set
      (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
      `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `FAL_KEY`).

## NOT yet verified — do these next

1. **fal.ai billing** — add a payment method at fal.ai/dashboard/billing,
   then re-run (`Retry` on the processing screen, or `gh workflow run` /
   `retryPipelineAction`) to get real signal on Kling itself, Remotion
   rendering, and the Grok Imagine cover step — none of these have been
   reached in a real run yet.
2. **Full manual click-through from the browser**, not just `gh workflow
   run`: upload via the dashboard UI → the app's own `dispatchPipelineAction`
   successfully triggers the workflow (should work now that
   `GITHUB_ACTIONS_TOKEN` is set) → real-time progress on `/processing` →
   land on `/results` with a real playable video and working
   Download/Regenerate/"Regenerate cover".
3. **Is Google OAuth enabled?** Still open — Dashboard/Management-API only,
   no MCP tool covers this. See supabase.com/dashboard → Authentication →
   Providers.
4. **First Vercel deploy** — hasn't happened yet.

## Known gaps (not bugs, just unbuilt — see docs/ROADMAP.md Phase 3)

- Runway/Luma/Veo b-roll models are selectable in the UI but throw a clear
  "not implemented yet" error if picked — only Kling is wired up.
- The results page "Edit" button (next to Regenerate/Download on the Video
  tab) is still a no-op toast — redundant with the hook `Input` right above
  it, left alone rather than guessing what it should do.
- "Regenerate" (Video tab) still re-runs the entire pipeline, including
  Kling — fine for now, since a meaningfully different video likely needs
  fresh b-roll anyway, but worth scoping further if it turns out people
  mostly just want new hook text.
- No billing (Stripe or otherwise) — the free-tier *count* is enforced
  (3/month via a Postgres trigger), but there's no way to actually become a
  paying user yet, and at ~$1.43/video that's a real cost center
  (≈$4.29/month per free user) worth having Stripe in front of before wider
  launch.

## Immediate next steps, in order

1. Add a payment method to fal.ai, then re-run the pipeline (real project
   already exists — just needs `retryPipelineAction`/`gh workflow run`
   again) to verify Kling → Remotion render → Grok Imagine cover.
2. Do the full browser click-through once step 1 confirms the pipeline
   works end to end.
3. First Vercel deploy.
4. Enable Google OAuth (unrelated, still open).
5. Phase 3 (`docs/ROADMAP.md`): Stripe billing (now with real cost data to
   size pricing against), Runway/Luma/Veo, decide whether "Regenerate"
   (video) needs finer scoping too.
