import type { RichTranscriptWord } from "../lib/transcript-types";

// Generates YouTube publishing metadata from the finished transcript:
// title options, description, chapters and tags.
//
// This runs on the *corrected* transcript, which matters more than it
// sounds -- titles and tags are the searchable surface of the video, and a
// title containing "deep sig" instead of "DeepSeek" is worse than no title
// at all.

const MODEL = "gpt-5.6-luna";
/** Enough transcript for real understanding without paying for all of it. */
const MAX_CHARS = 24000;

export interface VideoMetadata {
  titles: { title: string; angle: string }[];
  hook: string;
  description: string;
  chapters: { timeSec: number; label: string }[];
  /** Go inline in the description; YouTube surfaces the first three above the title. */
  hashtags: string[];
  /** The separate Tags field in YouTube Studio, not part of the description. */
  tags: string[];
}

interface OpenAIResponse {
  choices?: { message?: { content?: string } }[];
}

function transcriptWithTimes(words: RichTranscriptWord[]): string {
  // A timestamp every ~30s gives the model enough anchoring to place
  // chapters without inflating the payload with per-word times.
  const parts: string[] = [];
  let nextMark = 0;
  for (const word of words) {
    if (word.start >= nextMark) {
      parts.push(`\n[${Math.floor(word.start / 60)}:${String(Math.floor(word.start % 60)).padStart(2, "0")}]`);
      nextMark = word.start + 30;
    }
    parts.push(word.punctuatedWord);
  }
  const text = parts.join(" ");
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n[...truncated]` : text;
}

export async function generateMetadata(
  words: RichTranscriptWord[],
  fallbackTitle: string
): Promise<VideoMetadata> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: [
            "You write YouTube packaging for a creator's own video, from its transcript.",
            "",
            "Titles: 5 options, each under 60 characters so nothing is truncated in search.",
            "Front-load the specific thing that makes this video worth clicking -- a number, a",
            "name, a claim, a contradiction. Vary the angle across the five so the creator can",
            "choose: curiosity, a concrete number, a contrarian take, a direct question, a",
            "plain descriptive one for search. Never invent a fact that is not in the",
            "transcript, and never use words like 'shocking' or 'insane' as filler.",
            "",
            "Hook: one or two sentences the creator could say or pin as a comment. It must be",
            "supported by the transcript.",
            "",
            "Description: 3-5 short paragraphs. Open with the payoff in the first two lines,",
            "since that is all YouTube shows before 'more'. Then what the video covers, then a",
            "line inviting comments. Write plainly. No hashtag walls.",
            "",
            "Chapters: 5-10, using the [m:ss] markers in the transcript. The first must be 0.",
            "",
            "Hashtags: 4-8, no spaces, most important first -- YouTube shows the first three",
            "above the title. Relevant to the actual content, not generic reach-bait.",
            "",
            "Tags: 10-15 lowercase search phrases people would actually type.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Filename: ${fallbackTitle}\n\nTranscript:\n${transcriptWithTimes(words)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "video_metadata",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["titles", "hook", "description", "chapters", "hashtags", "tags"],
            properties: {
              titles: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "angle"],
                  properties: { title: { type: "string" }, angle: { type: "string" } },
                },
              },
              hook: { type: "string" },
              description: { type: "string" },
              chapters: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["timeSec", "label"],
                  properties: { timeSec: { type: "number" }, label: { type: "string" } },
                },
              },
              hashtags: { type: "array", items: { type: "string" } },
              tags: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Metadata generation failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Metadata generation returned no content");
  return JSON.parse(content) as VideoMetadata;
}

function stamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Plain text for YouTube Studio.
 *
 * The description, chapters and hashtags are emitted as one contiguous
 * block between two markers, because that is how it gets used: select
 * once, paste once. Splitting them under separate headings means three
 * copies and a chance to paste them in the wrong order — chapters only work
 * when they sit inside the description itself.
 *
 * Titles and tags stay outside the block: they are different fields in
 * YouTube Studio, and only one title gets chosen.
 */
export function formatMetadata(meta: VideoMetadata): string {
  const lines: string[] = [];

  lines.push("PICK A TITLE", "");
  meta.titles.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.title}   —  ${t.angle}, ${t.title.length} chars`);
  });

  lines.push("", `PINNED COMMENT / SPOKEN HOOK`, "", meta.hook, "");

  lines.push(
    "",
    "─".repeat(64),
    "COPY EVERYTHING BELOW THIS LINE INTO THE DESCRIPTION",
    "─".repeat(64),
    "",
    meta.description.trim(),
    ""
  );

  if (meta.chapters.length > 0) {
    lines.push("Chapters:");
    // YouTube only recognises chapters when the first one is exactly 0:00.
    const chapters = [...meta.chapters].sort((a, b) => a.timeSec - b.timeSec);
    chapters.forEach((c, i) => lines.push(`${i === 0 ? "0:00" : stamp(c.timeSec)} ${c.label}`));
    lines.push("");
  }

  if (meta.hashtags.length > 0) {
    const hashtags = meta.hashtags.map((h) => (h.startsWith("#") ? h : `#${h.replace(/\s+/g, "")}`));
    lines.push(hashtags.join(" "), "");
  }

  lines.push("─".repeat(64), "END OF DESCRIPTION", "─".repeat(64), "");
  lines.push("", "TAGS  (separate field in YouTube Studio, not the description)", "", meta.tags.join(", "), "");

  return lines.join("\n");
}
