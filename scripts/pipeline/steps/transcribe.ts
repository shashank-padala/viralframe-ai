import type { Transcript } from "../lib/types";

const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
}

interface DeepgramResponse {
  results?: {
    channels?: {
      alternatives?: {
        transcript?: string;
        words?: DeepgramWord[];
      }[];
    }[];
  };
}

// Deepgram fetches the video directly from a signed URL rather than us
// streaming multi-GB source files through the runner's own memory.
export async function transcribe(sourceVideoUrl: string): Promise<Transcript> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not set");
  }

  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
  });

  const res = await fetch(`${DEEPGRAM_URL}?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: sourceVideoUrl }),
  });

  if (!res.ok) {
    throw new Error(`Deepgram transcription failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as DeepgramResponse;
  const alternative = data.results?.channels?.[0]?.alternatives?.[0];
  if (!alternative) {
    throw new Error("Deepgram response is missing a transcript alternative");
  }

  return {
    text: alternative.transcript ?? "",
    words: (alternative.words ?? []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
  };
}
