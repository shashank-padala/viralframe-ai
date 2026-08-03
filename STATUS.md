# Status

_Last updated: 2026-08-02_

Read this first in a new session. For the "why", see `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`.

## New this session: local captioning CLI (`scripts/caption/`)

A second, independent entry point into the render stack — **not** part of
the hosted reel pipeline. It takes a landscape long-form recording and
returns a YouTube-ready captioned MP4 at the source's own resolution and
frame rate:

```
npx tsx scripts/caption/cli.ts "<input.mp4>" [--range 0:60] [--style hormozi|clean]
                                             [--band top|center|bottom]
                                             [--from-edl] [--no-vision] [--no-llm] [--plan-only]
```

Architecturally the important part is that every analysis stage writes into
one **edit document** (`<name>.edl.json`, see `scripts/caption/edl.ts`) and
the renderer is a pure function of it. That is what makes pause removal
(Phase 2 below) tractable: deleting time from the middle of a video
invalidates every downstream timestamp, and `scripts/caption/timeline.ts`
is the single place that remap is defined. It is the identity function
today because V1 keeps the whole video.

Stages: probe/hash → Deepgram (cached per source hash) → **name/term
correction** → deterministic card grouping → timing hygiene → highlight
marking → per-segment placement → Remotion render (silent) → ffmpeg mux of
the untouched source audio.

### Correction pass (`scripts/caption/plan/correct.ts`)

Speech-to-text reliably mangles exactly what a tech video is about — a real
run produced `deep sig` for DeepSeek, `open terminal bench` for
Terminal-Bench, `Anthropic Fable PHY`. Those errors hurt far more in a
burned-in caption than an ordinary word, because they are what the viewer is
reading for.

The dangerous implementation is handing the transcript to a model and taking
a corrected version back: it silently rephrases, drops filler and merges
sentences, destroying the word-to-timestamp alignment the whole pipeline
rests on. So the model returns **targeted replacements addressed by index +
span**, and every one is checked against the words actually at that range
before being applied. Guards: unmatched `from` is discarded rather than
guessed at, replacements over 4 words are rejected, overlapping corrections
resolve first-wins, and a batch wanting to change more than 12% of the
transcript is thrown out wholesale as a likely rewrite. A run's outer start
and end are preserved exactly, so a correction can never drift the captions
around it — which matters because spans let word counts change (`deep sig`
→ `DeepSeek` is 2 words becoming 1). Cached separately from the Deepgram
result so tuning the prompt does not re-charge transcription.
`--no-correct` opts out.

### Two render engines (`--engine ass` is the default)

| engine | full 10:39 render | vs playtime | how |
|---|---|---|---|
| `ass` (default) | **6 min 13 s** | 0.58× | ffmpeg + libass burns captions in the filter graph |
| `remotion` | ~95 min | 8.9× | headless Chrome screenshots one frame at a time |

Measured on the same edit document, not estimated — ~15×. Both full-length
outputs exist side by side in the source folder for comparison.
Remotion's cost is structural: ~6.7 frames/sec means a 10-minute 60fps video
is ~38,000 frames and ~95 minutes. libass composites text during the encode,
so only the video re-encode remains (unavoidable for burn-in).

`scripts/caption/ass.ts` generates the subtitle script from the same edit
document, so both engines render the same plan. Everything the caption style
uses maps over: weight, uppercase, thick outline, shadow, per-word colour,
the 3×3 zone (ASS `\an1`–`\an9`), the 52% width cap for off-centre zones
(expressed as a deliberately large opposite margin, since libass has no
max-width), and a 120ms scale pop-in plus fade.

Gotchas that are easy to get wrong and are handled:
- ASS colours are `&HAABBGGRR` — **blue-green-red**, reversed from CSS hex.
- A heavy family (Lato Black) must not also set `Bold: 1`, or libass
  synthesises a smeared double weight.
- `\r` resets *all* overrides, so the per-word highlight restores the colour
  explicitly rather than using it.
- The filter argument needs `:` and `\` escaped, not merely quoting.
- `--range` shifts the subtitle timings to match input-side seeking, so the
  fast seek stays in sync.

**Font caveat**: Remotion uses Montserrat 900 via `@remotion/google-fonts`;
libass resolves through fontconfig and Montserrat is not installed, so the
ASS path picks **Lato Black**. `pickFont()` prefers Montserrat when present,
so `apt-get install fonts-montserrat` gets the two engines to parity.
Naming an absent font is worse than picking a present one -- libass silently
falls back to a default serif that looks nothing like the intended captions.

Remotion stays as the editor preview (same React component, WYSIWYG) and as
the fidelity reference. Export defaults to ASS.

### Placement: zones, not bands

Placement returns a **3×3 zone** (band + horizontal alignment), not just a
vertical band. Three bands cannot express the correct answer for a screen
recording with a webcam inset, where the only safe area is a specific
corner. Off-centre captions cap their width at 52% so a long card cannot
grow back across the region the alignment was chosen to avoid.

The vision prompt now **classifies the layout first** (`talking_head` /
`screen_with_webcam` / `screen_only` / `other`) and applies a rule per case.
The original prompt assumed "talking head with a screen share behind them"
and said to avoid all readable text — which in a full-screen screen
recording describes the entire frame, so the model had no valid answer and
returned arbitrary bands that sat on the content.

Long shots are also **subdivided on a clock** (≥25 s chunks, capped at 40
samples). Scene detection found only 3 "shots" in 10.6 minutes because
scrolling a feed never trips the scene score, so placement could not adapt
even though the screen content changed constantly.

**Status: code-complete, typecheck + lint clean, NOT yet run end to end** —
`ffmpeg`/`ffprobe` are not installed in this WSL environment and `sudo`
needs a password. Install them (`sudo apt-get install -y ffmpeg`) and the
first real run is `--range 0:60` against
`/mnt/c/Users/shash/Videos/Did the AI Bubble Crash.mp4`.

Verified so far, without ffmpeg:

- [x] Card grouping and timing invariants hold on a synthetic transcript
      built to contain the known failure shapes (number+unit, acronym+noun,
      adverb+verb, trailing articles/auxiliaries): no card over 4 words,
      none under 0.5 s on screen, none straddling a sentence end, no card
      ending on a stop word, `$500 billion` and `AI bubble` kept intact.
- [x] `CaptionedVideo` composition bundles, `@remotion/google-fonts`
      resolves inside the bundle, and `calculateMetadata` derives geometry
      and duration from the source's real values (checked with a
      non-integer 59.94 fps, which the reel path's hardcoded 30 would have
      silently resampled).
- [x] `npx tsc --noEmit` and `npm run lint` clean across the repo.

Not yet exercised at all: Deepgram with the new parameters, the highlight
pass, the vision placement pass, and the render itself.

### Deliberately deferred (designed for, not built)

- **Pause/filler removal.** Detect with `silencedetect` intersected with
  transcript word gaps (the transcript distinguishes breath from room tone,
  dB alone does not), plus `filler_words` and LLM-flagged false starts.
  Pre-cut with ffmpeg rather than per-segment Remotion `<Sequence>` trims —
  faster and cleaner audio. Then feed the keep-list through `timeline.ts`.
- **B-roll for long-form.** The existing Kling path is ~97% of per-video
  cost and generic text-to-video is weak for commentary; on-screen assets
  (tweets, charts) as Ken Burns cutaways and animated stat cards are the
  higher-value first move.
- **Product-ization.** `edit.json` → DB row, `@remotion/player` preview
  against the same composition, transcript/band editing on `/results`, and
  a `render_only` pipeline mode that re-renders without re-paying for
  transcription or b-roll.

## Also new: caption workspace at `/editor` (dev only)

**This is now the real editing surface for the long-form caption product.**
The dashboard/results screens still belong to the older short-form reel
pipeline and were left alone deliberately — see "Dead UI" below.

Play the video, click any word to jump there, correct it, adjust style and
placement, re-render — all against the same edit document the CLI writes.

- `/editor` with no query lists every `.edl.json` found under the allowed
  roots; `/editor?file=<path>` opens one.
- **Controls that reach the renderer, and nothing else**: caption style
  (`hormozi` / `clean`), placement band (Auto keeps the per-shot vision
  result; Top/Center/Bottom pins one for the whole video), emphasis count,
  and Preview-60s-from-playhead / Full render buttons. A render always saves
  first, since the CLI runs `--from-edl` and would otherwise silently render
  stale text.
- **Find and replace across the whole transcript.** At 639 cards / 2,000
  words, fixing a recurring mis-transcription one click at a time is not
  viable; replace-all rewrites only the matched run, so "Nvidia's" becomes
  "NVIDIA's" rather than losing the possessive.
- Renders run detached from the request that starts them (a full render is
  far too long to hold an HTTP response open) with progress polled from an
  in-memory job registry in `src/lib/editor/render-jobs.ts`.
- **Performance**: card rows are memoised and the active-card index is only
  written to state when it actually changes. Deriving it straight from a
  60fps clock would reconcile ~2,000 word buttons sixty times a second.

### Dead UI, deliberately not touched yet

`projects.style` is written by the dashboard upload form and **read by
nothing** — no pipeline stage consumes it. `projects.platform`
(Reel/TikTok/Shorts) only renders the `9:16 · reel` chip on `/results`.
Both are leftovers from the short-form vision. They were left in place
because changing them without porting the caption stages into the hosted
GitHub Actions pipeline would just produce a different set of inert fields.
Remove them when that port happens.
- Edits change **words only** — never grouping or timings. A corrected word
  is spoken at exactly the moment the mis-heard one was, and re-grouping on
  every keystroke would reshuffle cards out from under the cursor.
- One text field covers all three real corrections, by splitting on
  whitespace: retype to replace, clear to delete, type several words to
  split one token (the span divides proportionally by token length).
  `H` toggles the yellow highlight, which stays exclusive per card.
- Keyboard: `Space` play/pause, `←`/`→` move, `Enter` edit, `H` highlight,
  `Cmd/Ctrl-S` save. The active card auto-scrolls during playback but never
  while you are typing.

**Security posture — read before deploying.** These routes read and write
arbitrary local files, so two independent controls apply and both are
enforced in every handler, not just the UI: the feature throws unless
`NODE_ENV` is development, and every path is realpath-resolved and must
land inside an allowed root (`$HOME` and `/mnt/c/Users` by default,
overridable with `CAPTION_EDITOR_ROOTS`). The build output confirms
`/editor` and `/api/editor/*` exist as dynamic routes — they are inert in
production rather than absent, so do not weaken either control.

Verified against a running dev server with a synthetic edit document
pointing at the real 135 MB recording:

- [x] `GET /api/editor/edl` returns the document; `PUT` saves it (write to
      a temp sibling then rename, so an interrupted save cannot leave a
      half-written document where the renderer expects one) and leaves no
      temp file behind.
- [x] `GET /api/editor/video` honours `Range` — returned `206` with
      `content-range: bytes 0-1023/135528994`. Without this the browser
      cannot seek at all on a file this size, which would defeat the whole
      editor.
- [x] `?file=/etc/passwd` refused with `403` and a message naming the
      allowed roots.
- [x] `/editor` list page and `/editor?file=…` both server-render the
      transcript.
- [x] `applyWordEdit`/`toggleHighlight` (extracted to
      `src/lib/editor/edit-word.ts` so they are testable outside the client
      component) hold their invariants: replace preserves timings, delete
      removes the right word, split is proportional with the end pinned and
      no gap, highlight stays exclusive per card, out-of-range index is a
      no-op.
- [x] `npm run build` clean.

**NOT verified: the interactive UI in a browser.** No Chrome was available
in this environment, so clicking, seeking, inline editing, auto-scroll and
the keyboard shortcuts have only been reasoned about, not exercised. That
is the first thing to check once ffmpeg produces a real edit document.

### Shared changes this touched

- `scripts/pipeline/lib/types.ts` — `TranscriptWord` gained optional
  `punctuatedWord`/`confidence`, `Transcript` gained optional `utterances`.
  Optional so transcripts already stored in `projects.transcript` still
  parse.
- `scripts/pipeline/steps/transcribe.ts` now delegates to
  `scripts/caption/lib/deepgram.ts` so the hosted pipeline and the CLI
  cannot drift on which Deepgram features they request. **The hosted
  pipeline now requests `utterances`/`paragraphs`/`filler_words` too** — it
  gets strictly better data, but this path has not been re-run since the
  change.
- `serveLocalDir()` moved out of `steps/render.ts` into
  `scripts/pipeline/lib/assetServer.ts`; both renderers use it.

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
