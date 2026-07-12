# ViralFrame AI

Upload a talking-head video and get back a split-screen (AI b-roll top / your
video bottom) vertical reel with an auto-generated hook and captions, ready
for Reels, TikTok, and Shorts.

Ported from the UX mocks in `reel-magic-ai-40` (Vite + TanStack Start) to
Next.js (App Router) + shadcn/ui, wired to Supabase for auth, storage, and
the project database.

## Docs

- **[`STATUS.md`](./STATUS.md)** — current state, what's verified, what to
  do next. Start here.
- **[`docs/PRODUCT.md`](./docs/PRODUCT.md)** — product vision, target user, core loop.
- **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** — stack, data model, request flow, framework gotchas.
- **[`docs/ROADMAP.md`](./docs/ROADMAP.md)** — phased plan from here to a real AI pipeline.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **shadcn/ui** (`radix-nova` base) + Tailwind v4 — dark violet/magenta theme
  ported from the original mocks (`src/app/globals.css`)
- **Supabase** — Auth (Google OAuth + email magic link), Postgres, Storage

## What's real vs. simulated

- **Real**: auth, video upload to Supabase Storage, the `projects` /
  `reel_variations` tables, and all edits on the results page (hook, layout,
  caption style) persist to the database.
- **Simulated**: the "AI" processing step (`/processing`) runs a scripted
  progress animation and writes templated hook variations — there's no real
  video/b-roll rendering pipeline yet. The results page's Download/Regenerate
  buttons surface a "not wired up yet" toast rather than pretending to work.

## Setup

1. Create a Supabase project.
2. Run the migration in `supabase/migrations/0001_init.sql` against it (SQL
   Editor, or `supabase db push` if you're using the Supabase CLI locally).
3. In Authentication → Providers, enable **Google** OAuth and add your
   `https://<your-domain>/auth/callback` redirect URL (and
   `http://localhost:3000/auth/callback` for local dev). Email OTP
   (magic link) is enabled by default.
4. Copy `.env.example` to `.env.local` and fill in your project's URL
   and publishable key from Project Settings → API.
5. `npm install && npm run dev`

## Project structure

- `src/app/*` — routes (landing, pricing, login, dashboard, processing, results)
- `src/components/site/*` — shared marketing/product components (Nav, Footer, ReelMockup)
- `src/components/ui/*` — shadcn/ui primitives
- `src/lib/supabase/*` — browser/server Supabase clients, DB types, server actions
- `src/proxy.ts` — session refresh + route protection (Next.js 16 renamed `middleware` to `proxy`)
- `supabase/migrations/*` — schema, RLS policies, storage buckets
