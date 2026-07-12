# Architecture

## Origin

The UI was designed in Lovable and lives as a Vite + TanStack Start mock at
`~/reel-magic-ai-40` (sibling repo, not this one) — shadcn "new-york" style,
dark violet/magenta theme, Inter + Instrument Serif fonts. This repo is a
from-scratch Next.js port of that design, wired to a real backend. When in
doubt about intended visual/UX behavior for a screen, that repo is the
source of truth for *design intent*; this repo is the source of truth for
*implementation*.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2.10, App Router, Turbopack | See the Next.js 16 gotchas below — this version renamed `middleware` to `proxy`. |
| UI | shadcn/ui (CLI v4, `radix-nova` base, unified `radix-ui` package) + Tailwind v4 | Not the "new-york" style CLI you may remember; the CLI reworked style/preset options. Run `npx shadcn@latest docs <component>` before hand-editing a primitive. |
| Backend | Supabase (Postgres, Auth, Storage, Realtime) | No custom API server for CRUD — pages talk to Supabase directly via `@supabase/ssr`. Realtime is used for live pipeline progress (`projects` table, added to the `supabase_realtime` publication in `0005_enable_realtime.sql`). |
| AI pipeline orchestration | GitHub Actions (`.github/workflows/process-video.yml`) | Not Vercel — a GitHub-hosted runner is a full Linux VM with generous compute/time (vs. a serverless Function's ceilings), which the multi-minute render pipeline needs. Triggered via `workflow_dispatch` from a Next.js Server Action (`src/lib/pipeline/actions.ts`). |
| Deploy target | Vercel | The Next.js app itself. The pipeline scripts run on GitHub Actions, not Vercel — see above. |

## Directory map

```
src/app/                    routes (App Router)
  page.tsx                  landing (marketing)
  pricing/page.tsx           pricing (marketing)
  login/                    login page + login-form.tsx (client) — Google OAuth + email magic link
  auth/callback/route.ts    exchanges the OAuth/OTP code for a session, redirects to `next`
  dashboard/                upload UI (dashboard-client.tsx) + history list + free-tier pre-check
  processing/                real pipeline progress via Supabase Realtime (processing-client.tsx)
  results/                  edit/export screen (results-client.tsx) — Download/Regenerate/Share are real
  globals.css               ported design tokens (brand colors, gradients, fonts)
src/components/site/         Nav (auth-aware, Server Component), Footer, ReelMockup (pure presentational)
src/components/ui/           shadcn primitives (button, select, tabs, input, label, sonner)
src/lib/supabase/
  client.ts                 browser client (createBrowserClient)
  server.ts                 server client for Server Components/Actions (cookies-based)
  actions.ts                Server Actions (currently just signOutAction)
  types.ts                  Database type, regenerated from the live schema via Supabase MCP
src/lib/pipeline/actions.ts  Server Actions that dispatch/retry the GitHub Actions workflow
src/proxy.ts                 session refresh + route protection (Next 16's replacement for middleware.ts)
scripts/pipeline/            the actual AI pipeline — runs in GitHub Actions, not the Next.js app
  run.ts                    orchestrator: transcribe -> hooks/scenes -> b-roll -> render -> cover
  steps/                    one file per external call (Deepgram, gpt-5.4-mini, fal.ai/Kling,
                             Remotion render, gpt-image-1 cover)
  lib/                      Supabase admin client, PipelineContext (stage/error/storage helpers),
                             retry/backoff, local-file staging, ffprobe
remotion/                    the video composition Remotion renders server-side
  ReelComposition.tsx        split-layout + caption burn-in + hook overlay
  Root.tsx, index.ts         composition registration, calculateMetadata for variable duration
.github/workflows/
  process-video.yml         workflow_dispatch(project_id) -> installs ffmpeg -> runs scripts/pipeline/run.ts
supabase/migrations/         schema, RLS, storage buckets, Realtime, free-tier trigger — full SQL source of truth
```

## Data model

Four tables, all RLS-scoped to `auth.uid()`:

- **`profiles`** — 1:1 with `auth.users`, auto-created by a trigger
  (`handle_new_user`) on signup.
- **`projects`** — one row per uploaded video. Holds the current edit state
  directly (`layout`, `caption_style`, `current_hook`) rather than
  versioning edits — the results page is a live editor, not a history.
  `status` moves `uploaded → processing → ready` (or `failed`).
  `pipeline_stage` (`transcribing → writing_hooks → generating_broll →
  rendering → generating_cover → ready`, or `failed`) is the real-time
  progress signal the processing screen subscribes to; `error_message` is
  set alongside `failed`; `transcript` holds the Deepgram response
  (word-level timestamps) once the first stage completes. A
  `SECURITY DEFINER` trigger (`enforce_free_tier_upload_limit`) blocks a 4th
  insert in a calendar month for `plan = 'free'` users.
- **`reel_variations`** — the 3 AI-suggested hook options per project
  (label + hook text + `is_selected`), now written by a real `gpt-5.4-mini`
  structured-output call instead of string templates. Selecting one copies
  its hook into `projects.current_hook`.
- **`broll_clips`** — one row per AI-generated b-roll scene (`scene_index`,
  `prompt`, `model`, `status`, `storage_path`), generated in parallel per
  project. Not surfaced in the UI yet — internal to the render step.

Storage: two private buckets, `source-videos` and `reel-exports`, both keyed
by path `${auth.uid()}/${project_id}/${filename}` — the first path segment
doubles as the RLS ownership check (`storage.foldername(name)[1]`). B-roll
clips, the final rendered video, and cover images all land in `reel-exports`.

Realtime: `projects` is in the `supabase_realtime` publication (added in
`0005_enable_realtime.sql` — this is not on by default for new tables) so
the processing screen can subscribe to `pipeline_stage` changes directly.

Full schema: `supabase/migrations/0001_init.sql` through `0006_*.sql`.

## Request flow: upload → results

```
Dashboard (client)              GitHub Actions               Processing (client)         Results (client)
  file picked/dropped             (scripts/pipeline/run.ts)     Realtime subscription
  → free-tier pre-check           1. transcribe (Deepgram)       on projects row
  → storage.upload(                  -> projects.transcript      (pipeline_stage,
      source-videos/uid/pid/file)  2. gpt-5.4-mini: hooks +       error_message)
  → insert projects row               b-roll scene prompts        maps to the step list;
      (status=processing,           -> reel_variations             on status=ready,
       triggers free-tier check)  3. per-scene b-roll via          router.push(/results)
  → dispatchPipelineAction()          fal.ai/Kling (parallel)      on failure: shows
      (Server Action -> GitHub       -> broll_clips + Storage       error_message + Retry
       Actions workflow_dispatch)  4. Remotion render                (re-dispatches the
  → router.push(/processing)          (captions, hook overlay,       same workflow)
                                       split layout)
                                       -> projects.output_video_path
                                     5. gpt-image-1 cover                                  reads project + variations
                                       (ffmpeg frame + AI bg)                               edits write straight to
                                       -> projects.cover_image_path                         Supabase on change/blur
                                     -> pipeline_stage = ready                              Download/Regenerate/Share
                                        (or failed + error_message)                         are real (signed Storage
                                                                                             URLs, workflow re-dispatch,
                                                                                             clipboard copy)
```

**What's real**: everything in that diagram. The processing UI's fake
`setTimeout` animation and the string-templated hooks are gone. The only
UI element still faking nothing-yet-real is the results page's "Edit"
button next to Regenerate (ambiguous/redundant with the hook `Input` right
above it) — it still shows a plain "Not wired up yet." toast rather than
guessing what it should do.

## Auth

Google OAuth + email magic link (Supabase Auth), both triggered client-side
from `login-form.tsx` via the browser Supabase client (`signInWithOAuth`,
`signInWithOtp`). `src/app/auth/callback/route.ts` exchanges the resulting
`code` for a session and redirects to `?next=`.

`src/proxy.ts` runs on every request: refreshes the session cookie (required
so users don't get silently logged out) and redirects unauthenticated
requests to `/dashboard`, `/processing`, `/results` to `/login`.

## Next.js 16 gotchas (read before touching routing/auth code)

- `middleware.ts` is deprecated → renamed `proxy.ts`, exported function is
  `proxy` not `middleware`. Already applied here; don't reintroduce a
  `middleware.ts`.
- Route/page `params` and `searchParams` are `Promise`s — every page in
  this repo that reads them is `async` and `await`s them.
- Full doc set is vendored at `node_modules/next/dist/docs/` — check there
  before assuming a pre-16 API still works. `AGENTS.md` at the repo root
  flags this for any agent working in this repo.

## shadcn CLI v4 gotchas

- `npx shadcn@latest init` now takes `-d`/`--defaults` or `--preset`, not
  `--style new-york`/`--base-color` (those flags error now). We used
  `init -d --base radix`.
- Components import from the unified `radix-ui` package
  (`import { Slot } from "radix-ui"`), not per-primitive
  `@radix-ui/react-*` packages.
- Button's default size is `h-8` (compact), and variant/size names differ
  slightly from the old "new-york" style — check `src/components/ui/button.tsx`
  before assuming a variant name from memory.

## Supabase key naming

The project uses Supabase's newer key format: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(`sb_publishable_...`), not the legacy JWT-style `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
All three client constructors (`client.ts`, `server.ts`, `proxy.ts`) and
`.env.local.example` use the new name — keep it consistent if you add more
Supabase call sites.

`scripts/pipeline/lib/supabaseAdmin.ts` is different: it uses
`SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS entirely) because the pipeline
runs unattended in GitHub Actions with no user session. Never import that
module from app code that runs in the browser or in a user-facing server
context — it's for the pipeline runner only.

## Type drift risk

`src/lib/supabase/types.ts` is generated from the live schema via
`mcp__supabase__generate_typescript_types`, not hand-maintained — regenerate
it after every migration:

```
mcp__supabase__generate_typescript_types
```

Then reintroduce the hand-written convenience unions the generator doesn't
emit — `Platform`, `ProjectStatus`, `Layout`, `BrollModel`, `PipelineStage`,
`BrollClipStatus` — layered on top of the generated `Database` type so app
code gets literal types instead of plain `string` for those columns.

## MCP

A project-scoped Supabase MCP server is registered in `.mcp.json`
(`project_ref=oqqfejxdewevfxnjblsi`). MCP servers only connect on session
start, so if it's not showing up in your tool list, restart Claude Code in
this directory.
