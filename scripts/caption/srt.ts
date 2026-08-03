import { endsSentence, type RichTranscriptWord } from "./lib/transcript-types";

// The .srt sidecar is generated from the same word timings as the burned-in
// captions, but grouped differently on purpose. Burned-in cards are 3-4
// words because they are a visual rhythm device; a subtitle file is read by
// people who need the actual text, and by YouTube for search indexing, so
// it wants full sentences.

const MAX_LINE_CHARS = 84;
const MAX_CUE_SEC = 6;

function timestamp(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  const milli = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s},${milli}`;
}

export function buildSrt(words: RichTranscriptWord[]): string {
  const cues: RichTranscriptWord[][] = [];
  let current: RichTranscriptWord[] = [];

  for (const word of words) {
    current.push(word);
    const text = current.map((w) => w.punctuatedWord).join(" ");
    const duration = word.end - current[0].start;
    if (endsSentence(word) || text.length >= MAX_LINE_CHARS || duration >= MAX_CUE_SEC) {
      cues.push(current);
      current = [];
    }
  }
  if (current.length > 0) cues.push(current);

  return cues
    .map((cue, i) => {
      const text = cue.map((w) => w.punctuatedWord).join(" ");
      return `${i + 1}\n${timestamp(cue[0].start)} --> ${timestamp(cue[cue.length - 1].end)}\n${text}\n`;
    })
    .join("\n");
}
