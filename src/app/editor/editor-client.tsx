"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Film, Pause, Play, Save, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyWordEdit, toggleHighlight as toggleCardHighlight } from "@/lib/editor/edit-word";
import type {
  CaptionAlign,
  CaptionBand,
  CaptionCard,
  EditDocument,
  PlacementSegment,
} from "../../../scripts/caption/edl";

// The workspace for CapCut-style captions on a long-form video: correct the
// transcript, control the emphasis, choose where captions sit, re-render.
//
// Only settings that actually reach the renderer appear here. Anything the
// pipeline does not read has no business taking up space.

interface Selection {
  cardIndex: number;
  wordIndex: number;
}

interface RenderJob {
  id: string;
  status: "running" | "succeeded" | "failed";
  lines: string[];
  outputPath?: string;
}

const STYLE_OPTIONS = [
  { id: "hormozi", label: "Hormozi", hint: "Heavy uppercase, thick outline, yellow keyword" },
  { id: "clean", label: "Clean", hint: "Sentence case on a dark pill" },
];

// A 3x3 zone grid rather than three bands: on a screen recording with a
// webcam inset, the only safe area is often a specific corner, which a
// vertical band alone cannot express.
const BANDS: CaptionBand[] = ["top", "center", "bottom"];
const ALIGNS: CaptionAlign[] = ["left", "center", "right"];

function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Owns its own animation frame so the clock can tick at 60fps without
 * re-rendering the transcript list behind it.
 */
function Clock({
  videoRef,
  durationSec,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  durationSec: number;
}) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) setTime(video.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [videoRef]);

  return (
    <span className="font-mono text-sm tabular-nums">
      {formatTime(time)} / {formatTime(durationSec)}
    </span>
  );
}

interface CardRowProps {
  card: CaptionCard;
  cardIndex: number;
  isActive: boolean;
  selectedWordIndex: number | null;
  draft: string | null;
  matchTerm: string;
  onSeekCard: (cardIndex: number) => void;
  onSelect: (cardIndex: number, wordIndex: number) => void;
  onStartEdit: (cardIndex: number, wordIndex: number) => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

// Memoised because a 10-minute video produces ~640 rows and ~2,000 word
// buttons. Without this the whole list reconciles every time playback moves
// the active card, and scrubbing becomes visibly janky.
const CardRow = memo(function CardRow({
  card,
  cardIndex,
  isActive,
  selectedWordIndex,
  draft,
  matchTerm,
  onSeekCard,
  onSelect,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
}: CardRowProps) {
  return (
    <div
      data-card-index={cardIndex}
      className={`flex gap-3 rounded-md px-2 py-1.5 ${isActive ? "bg-brand/10" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSeekCard(cardIndex)}
        className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        {formatTime(card.startSec)}
      </button>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {card.words.map((word, wordIndex) => {
          const isSelected = selectedWordIndex === wordIndex;

          if (isSelected && draft !== null) {
            return (
              <input
                key={wordIndex}
                autoFocus
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={onCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onCommit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                  }
                }}
                className="w-32 rounded border border-brand bg-background px-1.5 py-0.5 text-sm outline-none"
              />
            );
          }

          const isMatch = matchTerm.length > 0 && word.text.toLowerCase().includes(matchTerm);
          return (
            <button
              key={wordIndex}
              type="button"
              onClick={() => onSelect(cardIndex, wordIndex)}
              onDoubleClick={() => onStartEdit(cardIndex, wordIndex)}
              className={`rounded px-1.5 py-0.5 text-sm transition-colors ${
                isSelected
                  ? "bg-brand text-primary-foreground"
                  : isMatch
                    ? "bg-sky-500/30 hover:bg-sky-500/40"
                    : "hover:bg-muted"
              } ${word.highlight && !isSelected ? "font-semibold text-amber-400" : ""}`}
            >
              {word.text}
            </button>
          );
        })}
      </div>
    </div>
  );
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 pt-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function EditorClient({
  edlPath,
  initialEdl,
}: {
  edlPath: string;
  initialEdl: EditDocument;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [cards, setCards] = useState<CaptionCard[]>(initialEdl.cards);
  const [styleId, setStyleId] = useState(initialEdl.styleId);
  const [placement, setPlacement] = useState<PlacementSegment[]>(initialEdl.placement);
  const [bandChoice, setBandChoice] = useState<{ band: CaptionBand; align: CaptionAlign } | "auto">(
    "auto"
  );

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [replacement, setReplacement] = useState("");
  const [job, setJob] = useState<RenderJob | null>(null);

  const editing = draft !== null;
  const videoUrl = `/api/editor/video?file=${encodeURIComponent(initialEdl.source.path)}`;

  // Cards are mirrored into a ref so the animation-frame loop and the
  // stable callbacks can read the current list without taking it as a
  // dependency -- otherwise the rAF effect would tear down and restart on
  // every keystroke. Synced in an effect rather than during render, which
  // React forbids.
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // The active card is derived at 60fps but only written to state when the
  // index actually changes -- React bails out on an identical value, so the
  // list re-renders roughly once a second instead of sixty times.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        const t = video.currentTime;
        const list = cardsRef.current;
        const found = list.findIndex((c) => t >= c.startSec && t < c.endSec);
        setActiveCardIndex(found === -1 ? null : found);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!playing || editing || activeCardIndex === null) return;
    listRef.current
      ?.querySelector(`[data-card-index="${activeCardIndex}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeCardIndex, playing, editing]);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = seconds;
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const onSeekCard = useCallback(
    (cardIndex: number) => seekTo(cardsRef.current[cardIndex].startSec),
    [seekTo]
  );

  const onSelect = useCallback(
    (cardIndex: number, wordIndex: number) => {
      setSelection({ cardIndex, wordIndex });
      setDraft(null);
      seekTo(cardsRef.current[cardIndex].words[wordIndex].startSec);
    },
    [seekTo]
  );

  const onStartEdit = useCallback((cardIndex: number, wordIndex: number) => {
    const word = cardsRef.current[cardIndex]?.words[wordIndex];
    if (!word) return;
    // Editing is deliberate; leaving playback running would scroll the
    // transcript out from under the field.
    videoRef.current?.pause();
    setSelection({ cardIndex, wordIndex });
    setDraft(word.text);
  }, []);

  const onCommit = useCallback(() => {
    setDraft((currentDraft) => {
      if (currentDraft === null) return null;
      setSelection((at) => {
        if (!at) return at;
        setCards((previous) => {
          const next = [...previous];
          const edited = applyWordEdit(next[at.cardIndex], at.wordIndex, currentDraft);
          if (edited.words.length === 0) {
            next.splice(at.cardIndex, 1);
            return next.map((card, i) => ({ ...card, index: i }));
          }
          next[at.cardIndex] = edited;
          return next;
        });
        return at;
      });
      setDirty(true);
      return null;
    });
  }, []);

  const onCancel = useCallback(() => setDraft(null), []);

  const toggleHighlight = useCallback(() => {
    if (!selection) return;
    setCards((previous) => {
      const next = [...previous];
      if (!next[selection.cardIndex]) return previous;
      next[selection.cardIndex] = toggleCardHighlight(next[selection.cardIndex], selection.wordIndex);
      return next;
    });
    setDirty(true);
  }, [selection]);

  const moveSelection = useCallback(
    (delta: number) => {
      const list = cardsRef.current;
      if (!selection) {
        if (list.length > 0) onSelect(activeCardIndex ?? 0, 0);
        return;
      }
      let { cardIndex, wordIndex } = selection;
      wordIndex += delta;
      while (wordIndex < 0 && cardIndex > 0) {
        cardIndex--;
        wordIndex += list[cardIndex].words.length;
      }
      while (wordIndex >= (list[cardIndex]?.words.length ?? 0) && cardIndex < list.length - 1) {
        wordIndex -= list[cardIndex].words.length;
        cardIndex++;
      }
      if (!list[cardIndex]?.words[wordIndex]) return;
      onSelect(cardIndex, wordIndex);
    },
    [activeCardIndex, onSelect, selection]
  );

  const buildDocument = useCallback(
    (): EditDocument => ({ ...initialEdl, cards, placement, styleId }),
    [cards, initialEdl, placement, styleId]
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/editor/edl?file=${encodeURIComponent(edlPath)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edl: buildDocument() }),
      });
      const body = (await response.json()) as { error?: string; cards?: number };
      if (!response.ok) throw new Error(body.error ?? `Save failed (${response.status})`);
      setDirty(false);
      toast.success(`Saved ${body.cards} cards`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSaving(false);
    }
  }, [buildDocument, edlPath]);

  const startRender = useCallback(
    async (mode: "preview" | "full") => {
      // Always save first: the CLI renders --from-edl, so an unsaved change
      // would silently not appear in the output.
      if (dirty && !(await save())) return;

      const from = Math.floor(videoRef.current?.currentTime ?? 0);
      const range: [number, number] | undefined =
        mode === "preview"
          ? [from, Math.min(from + 60, initialEdl.source.durationSec)]
          : undefined;

      const response = await fetch(`/api/editor/render?file=${encodeURIComponent(edlPath)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      });
      const body = (await response.json()) as { job?: RenderJob; error?: string };
      if (!response.ok || !body.job) {
        toast.error(body.error ?? "Couldn't start the render");
        return;
      }
      setJob(body.job);
    },
    [dirty, edlPath, initialEdl.source.durationSec, save]
  );

  // Poll while a render is in flight.
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/editor/render?job=${job.id}`);
      if (!response.ok) return;
      const body = (await response.json()) as { job?: RenderJob };
      if (!body.job) return;
      setJob(body.job);
      if (body.job.status === "succeeded") toast.success("Render finished");
      if (body.job.status === "failed") toast.error("Render failed — see the log");
    }, 2000);
    return () => clearInterval(timer);
  }, [job]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (editing || (target && ["INPUT", "TEXTAREA"].includes(target.tagName))) return;

      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void save();
        return;
      }
      switch (event.key) {
        case " ":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          event.preventDefault();
          moveSelection(1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          moveSelection(-1);
          break;
        case "Enter":
          event.preventDefault();
          if (selection) onStartEdit(selection.cardIndex, selection.wordIndex);
          break;
        case "h":
        case "H":
          event.preventDefault();
          toggleHighlight();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, moveSelection, onStartEdit, save, selection, toggleHighlight, togglePlay]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const matchTerm = search.trim().toLowerCase();
  const matchCount = useMemo(() => {
    if (!matchTerm) return 0;
    return cards.reduce(
      (sum, card) => sum + card.words.filter((w) => w.text.toLowerCase().includes(matchTerm)).length,
      0
    );
  }, [cards, matchTerm]);

  const replaceAll = useCallback(() => {
    if (!matchTerm) return;
    let replaced = 0;
    setCards((previous) =>
      previous.map((card) => ({
        ...card,
        words: card.words.map((word) => {
          if (!word.text.toLowerCase().includes(matchTerm)) return word;
          replaced++;
          // Replace the matched run only, so "Nvidia's" becomes "NVIDIA's"
          // rather than losing the possessive.
          const pattern = new RegExp(matchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          return { ...word, text: word.text.replace(pattern, replacement) };
        }),
      }))
    );
    setDirty(true);
    toast.success(`Replaced ${replaced} occurrence${replaced === 1 ? "" : "s"}`);
  }, [matchTerm, replacement]);

  const applyZone = useCallback(
    (zone: { band: CaptionBand; align: CaptionAlign } | "auto") => {
      setBandChoice(zone);
      setPlacement(
        zone === "auto"
          ? initialEdl.placement
          : [
              {
                startSec: 0,
                endSec: initialEdl.source.durationSec,
                band: zone.band,
                align: zone.align,
                reason: "pinned in the editor",
              },
            ]
      );
      setDirty(true);
    },
    [initialEdl.placement, initialEdl.source.durationSec]
  );

  const highlightCount = useMemo(
    () => cards.filter((c) => c.words.some((w) => w.highlight)).length,
    [cards]
  );
  const wordCount = useMemo(() => cards.reduce((sum, c) => sum + c.words.length, 0), [cards]);
  const totalFrames = Math.round(initialEdl.source.durationSec * initialEdl.source.fps);

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-5">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">
            {initialEdl.source.path.split("/").pop()}
          </h1>
          <p className="text-xs text-muted-foreground">
            {formatTime(initialEdl.source.durationSec)} · {initialEdl.source.width}×
            {initialEdl.source.height} @ {initialEdl.source.fps.toFixed(0)}fps ·{" "}
            {cards.length} cards · {wordCount} words
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-amber-400">Unsaved</span>}
          <Button variant="outline" onClick={() => void save()} disabled={!dirty || saving}>
            <Save className="mr-2 size-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full rounded-lg bg-black"
            controls
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={togglePlay}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Clock videoRef={videoRef} durationSec={initialEdl.source.durationSec} />
          </div>

          <Section title="Caption style">
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setStyleId(option.id);
                    setDirty(true);
                  }}
                  title={option.hint}
                  className={`rounded-lg border p-3 text-left text-sm transition ${
                    styleId === option.id
                      ? "border-brand/60 bg-brand/5"
                      : "border-border/60 hover:border-brand/40"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    {option.hint}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Placement">
            <div className="flex items-start gap-3">
              {/* The grid mirrors the frame, so picking a zone is picking a
                  spot on the video rather than decoding a label. */}
              <div className="grid aspect-video w-[132px] shrink-0 grid-cols-3 grid-rows-3 gap-px overflow-hidden rounded-md border border-border/60 bg-border/40">
                {BANDS.map((band) =>
                  ALIGNS.map((align) => {
                    const selected =
                      bandChoice !== "auto" &&
                      bandChoice.band === band &&
                      bandChoice.align === align;
                    return (
                      <button
                        key={`${band}-${align}`}
                        title={`${band} ${align}`}
                        onClick={() => applyZone({ band, align })}
                        className={`transition ${
                          selected ? "bg-brand" : "bg-background hover:bg-brand/30"
                        }`}
                      />
                    );
                  })
                )}
              </div>
              <div className="flex-1">
                <button
                  onClick={() => applyZone("auto")}
                  className={`w-full rounded-lg border px-2 py-2 text-xs transition ${
                    bandChoice === "auto"
                      ? "border-brand/60 bg-brand/5"
                      : "border-border/60 hover:border-brand/40"
                  }`}
                >
                  Auto (per shot)
                </button>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  {bandChoice === "auto"
                    ? initialEdl.placement
                        .map(
                          (p) => `${p.band}/${p.align ?? "center"} @ ${formatTime(p.startSec)}`
                        )
                        .join(", ")
                    : `Pinned ${bandChoice.band}/${bandChoice.align} for the whole video.`}
                </p>
              </div>
            </div>
          </Section>

          <Section title="Emphasis">
            <div className="flex items-center justify-between text-sm">
              <span>
                <Sparkles className="mr-1.5 inline size-3.5 text-amber-400" />
                {highlightCount} of {cards.length} cards
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round((highlightCount / Math.max(1, cards.length)) * 100)}%
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Select a word and press <kbd>H</kbd> to move the yellow highlight. One per card.
            </p>
          </Section>

          <Section title="Render">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={job?.status === "running"}
                onClick={() => void startRender("preview")}
              >
                <Film className="mr-2 size-4" /> Preview 60s
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={job?.status === "running"}
                onClick={() => void startRender("full")}
              >
                Full render
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Preview renders 60s from the playhead. A full render is {totalFrames.toLocaleString()}{" "}
              frames at {initialEdl.source.fps.toFixed(0)}fps — expect it to take a while.
            </p>
            {job && (
              <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-black/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
                {job.lines.slice(-40).join("\n")}
              </pre>
            )}
          </Section>
        </aside>

        <section className="min-w-0">
          <div className="sticky top-6 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/95 p-2 backdrop-blur">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a mis-transcribed word…"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <Input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Replace with…"
              className="h-9 w-40 text-sm"
            />
            <Button size="sm" variant="outline" disabled={!matchTerm} onClick={replaceAll}>
              Replace {matchCount > 0 ? matchCount : ""}
            </Button>
          </div>

          <div ref={listRef} className="space-y-0.5">
            {cards.map((card, cardIndex) => (
              <CardRow
                key={cardIndex}
                card={card}
                cardIndex={cardIndex}
                isActive={cardIndex === activeCardIndex}
                selectedWordIndex={selection?.cardIndex === cardIndex ? selection.wordIndex : null}
                draft={selection?.cardIndex === cardIndex ? draft : null}
                matchTerm={matchTerm}
                onSeekCard={onSeekCard}
                onSelect={onSelect}
                onStartEdit={onStartEdit}
                onDraftChange={setDraft}
                onCommit={onCommit}
                onCancel={onCancel}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
