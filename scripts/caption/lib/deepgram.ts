import fsp from "node:fs/promises";
import type { RichTranscript, RichTranscriptWord } from "./transcript-types";

const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";

// Everything requested here is load-bearing downstream:
//
// - punctuate/smart_format  -> `punctuated_word`, which is what captions
//   actually display ("18,000 crores", "AI") and what sentence detection
//   keys off. Without it you get lowercase, unpunctuated tokens.
// - utterances              -> natural phrase boundaries, a free hard-break
//   signal for caption grouping.
// - paragraphs              -> sentence structure for the .srt sidecar.
// - filler_words            -> "um"/"uh" with timestamps. Phase 2 cannot cut
//   what it cannot locate, and captions must never highlight one.
const PARAMS: Record<string, string> = {
  model: "nova-3",
  smart_format: "true",
  punctuate: "true",
  utterances: "true",
  paragraphs: "true",
  filler_words: "true",
};

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  punctuated_word?: string;
}

interface DeepgramResponse {
  results?: {
    channels?: {
      alternatives?: {
        transcript?: string;
        words?: DeepgramWord[];
      }[];
    }[];
    utterances?: { start: number; end: number }[];
  };
}

function parse(data: DeepgramResponse): RichTranscript {
  const alternative = data.results?.channels?.[0]?.alternatives?.[0];
  if (!alternative) {
    throw new Error("Deepgram response is missing a transcript alternative");
  }

  const words: RichTranscriptWord[] = (alternative.words ?? []).map((w) => ({
    word: w.word,
    // Fall back to the raw token so a missing punctuated_word degrades to
    // "captions look plainer" rather than "captions are blank".
    punctuatedWord: w.punctuated_word ?? w.word,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
  }));

  return {
    text: alternative.transcript ?? "",
    words,
    utterances: (data.results?.utterances ?? []).map((u) => ({ start: u.start, end: u.end })),
  };
}

async function request(body: BodyInit, contentType: string): Promise<RichTranscript> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not set");

  const res = await fetch(`${DEEPGRAM_URL}?${new URLSearchParams(PARAMS)}`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": contentType },
    body,
  });
  if (!res.ok) {
    throw new Error(`Deepgram transcription failed: ${res.status} ${await res.text()}`);
  }
  return parse((await res.json()) as DeepgramResponse);
}

/** Deepgram fetches the media itself -- used by the hosted pipeline. */
export function transcribeUrl(url: string): Promise<RichTranscript> {
  return request(JSON.stringify({ url }), "application/json");
}

/** Uploads bytes directly -- used by the local CLI, which has no signed URL. */
export async function transcribeLocalAudio(filePath: string): Promise<RichTranscript> {
  const buffer = await fsp.readFile(filePath);
  return request(new Uint8Array(buffer), "audio/wav");
}
