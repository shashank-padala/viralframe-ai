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
| Backend | Supabase (Postgres, Auth, Storage) | No custom API server — pages talk to Supabase directly via `@supabase/ssr`. |
| Deploy target | Vercel (not yet linked) | — |

## Directory map

```
src/app/                    routes (App Router)
  page.tsx                  landing (marketing)
  pricing/page.tsx           pricing (marketing)
  login/                    login page + login-form.tsx (client) — Google OAuth + email magic link
  auth/callback/route.ts    exchanges the OAuth/OTP code for a session, redirects to `next`
  dashboard/                upload UI (dashboard-client.tsx) + history list
  processing/                simulated AI pipeline animation (processing-client.tsx)
  results/                  edit/export screen (results-client.tsx)
  globals.css               ported design tokens (brand colors, gradients, fonts)
src/components/site/         Nav (auth-aware, Server Component), Footer, ReelMockup (pure presentational)
src/components/ui/           shadcn primitives (button, select, tabs, input, label, sonner)
src/lib/supabase/
  client.ts                 browser client (createBrowserClient)
  server.ts                 server client for Server Components/Actions (cookies-based)
  actions.ts                Server Actions (currently just signOutAction)
  types.ts                  hand-written Database type — see "Type drift risk" below
src/proxy.ts                 session refresh + route protection (Next 16's replacement for middleware.ts)
supabase/migrations/0001_init.sql   schema, RLS, storage buckets — full SQL source of truth
```

## Data model

Three tables, all RLS-scoped to `auth.uid()`:

- **`profiles`** — 1:1 with `auth.users`, auto-created by a trigger
  (`handle_new_user`) on signup.
- **`projects`** — one row per uploaded video. Holds the current edit state
  directly (`layout`, `caption_style`, `current_hook`) rather than
  versioning edits — the results page is a live editor, not a history.
  `status` moves `uploaded → processing → ready` (or `failed`).
- **`reel_variations`** — the 3 AI-suggested hook options per project
  (label + hook text + `is_selected`). Selecting one copies its hook into
  `projects.current_hook`.

Storage: two private buckets, `source-videos` and `reel-exports`, both keyed
by path `${auth.uid()}/${project_id}/${filename}` — the first path segment
doubles as the RLS ownership check (`storage.foldername(name)[1]`).

Full schema: [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).

## Request flow: upload → results

```
Dashboard (client)                Processing (client)              Results (client)
  file picked/dropped                on mount: 6-step
  → validate type/size                scripted animation
  → storage.upload(                   (900ms/step, no real AI)
      source-videos/uid/pid/file)     on completion:
  → insert projects row                → insert 3 reel_variations
      (status=processing)                (templated Bold/Curiosity/
  → router.push(                          Controversial hooks)
      /processing?projectId=pid)       → update projects
                                           (status=ready, current_hook)
                                        → router.push(/results?projectId=pid)
                                                                        reads project + variations
                                                                        edits (hook/layout/caption/
                                                                        variation select) write
                                                                        straight to Supabase on
                                                                        change/blur
```

**What's real**: auth, the Storage upload, and every DB read/write in that
diagram. **What's simulated**: the "AI" itself — there is no transcript
extraction, no b-roll selection/generation, no caption burn-in, no video
rendering. The hook variations are string templates built from the
project title, not model output. The Download/Regenerate/Share buttons on
the results page are wired to a `notImplemented()` toast, not dead-clicks,
so the UI doesn't lie about what's real.

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

## Type drift risk

`src/lib/supabase/types.ts` is **hand-written** to match
`supabase/migrations/0001_init.sql`, not generated. If the migration
changes, this file will silently drift. Once the Supabase MCP or CLI is
available in-session, regenerate it properly:

```
supabase gen types typescript --project-id oqqfejxdewevfxnjblsi > src/lib/supabase/types.ts
```

(then reintroduce the hand-written `Platform`/`ProjectStatus`/`Layout`
convenience unions if the generator doesn't emit them).

## MCP

A project-scoped Supabase MCP server is registered in `.mcp.json`
(`project_ref=oqqfejxdewevfxnjblsi`). MCP servers only connect on session
start, so if it's not showing up in your tool list, restart Claude Code in
this directory.
