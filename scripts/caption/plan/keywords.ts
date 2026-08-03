import type { CaptionCard } from "../edl";

// Marks at most one word per card as the highlight (the yellow one).
//
// Two tiers, in priority order:
//
//   1. Deterministic. Numbers, money and percentages are always the payload
//      of a sentence and never need a model to identify.
//   2. One batched LLM pass, which returns *indices only* under a strict
//      schema. It is structurally incapable of altering a word or inventing
//      a timing, which is the failure mode that makes LLM captioning
//      untrustworthy.
//
// Highlighting every card defeats the mechanism -- if everything is
// emphasised nothing is. The LLM is told to be sparse and the result is
// capped regardless of what it returns.

const MAX_HIGHLIGHT_RATIO = 0.4;
const BATCH_SIZE = 120;
const MODEL = "gpt-5.6-luna";

// Never the highlight, even if a model picks one.
const NEVER_HIGHLIGHT = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "from", "with", "by",
  "and", "or", "but", "so", "if", "as", "that", "this", "it", "its", "is",
  "are", "was", "were", "be", "been", "am", "has", "have", "had", "do",
  "does", "did", "will", "would", "can", "could", "should", "i", "you", "we",
  "they", "he", "she", "them", "us", "my", "your", "our", "their",
  "um", "uh", "uhh", "hmm", "mm", "like", "just", "really", "actually",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isHighlightable(text: string): boolean {
  const n = normalize(text);
  return n.length > 1 && !NEVER_HIGHLIGHT.has(n);
}

/** Numbers, currency, percentages -- unambiguously the point of the sentence. */
function deterministicPick(card: CaptionCard): number | null {
  for (let i = 0; i < card.words.length; i++) {
    const text = card.words[i].text;
    if (/\d/.test(text) || /[$₹€£%]/.test(text)) return i;
  }
  return null;
}

interface HighlightPick {
  cardIndex: number;
  wordIndex: number;
}

interface OpenAIResponse {
  choices?: { message?: { content?: string } }[];
}

async function askModel(
  cards: { cardIndex: number; words: string[] }[]
): Promise<HighlightPick[]> {
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
            "You pick the single most impactful word in short caption cards from a spoken video.",
            "That word gets visually emphasised, so it must be the one carrying the meaning:",
            "a concrete noun, a strong verb, a name, or a striking adjective.",
            "Never pick filler, pronouns, articles, prepositions, or auxiliary verbs.",
            "Be sparse: emphasise roughly one card in three. Skip any card with no standout word",
            "by simply omitting it from your output. Return indices only.",
          ].join(" "),
        },
        { role: "user", content: JSON.stringify({ cards }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "highlights",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["picks"],
            properties: {
              picks: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["cardIndex", "wordIndex"],
                  properties: {
                    cardIndex: { type: "integer" },
                    wordIndex: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Highlight selection failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Highlight selection returned no content");
  return (JSON.parse(content) as { picks?: HighlightPick[] }).picks ?? [];
}

export interface HighlightOptions {
  /** Skip the model call and rely on the deterministic tier alone. */
  deterministicOnly?: boolean;
  onWarn?: (message: string) => void;
}

export async function assignHighlights(
  cards: CaptionCard[],
  options: HighlightOptions = {}
): Promise<void> {
  const undecided: CaptionCard[] = [];

  for (const card of cards) {
    const pick = deterministicPick(card);
    if (pick !== null) {
      card.words[pick].highlight = true;
    } else {
      undecided.push(card);
    }
  }

  if (options.deterministicOnly || undecided.length === 0) return;

  const budget = Math.max(0, Math.floor(cards.length * MAX_HIGHLIGHT_RATIO) - (cards.length - undecided.length));
  if (budget <= 0) return;

  const byIndex = new Map(cards.map((c) => [c.index, c]));
  let spent = 0;

  for (let i = 0; i < undecided.length; i += BATCH_SIZE) {
    const batch = undecided.slice(i, i + BATCH_SIZE);
    let picks: HighlightPick[];
    try {
      picks = await askModel(
        batch.map((c) => ({ cardIndex: c.index, words: c.words.map((w) => w.text) }))
      );
    } catch (error) {
      // Deterministic highlights are already in place, so a model failure
      // degrades the look rather than failing the render.
      options.onWarn?.(
        `highlight pass failed for cards ${batch[0]?.index}-${batch.at(-1)?.index}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      continue;
    }

    for (const pick of picks) {
      if (spent >= budget) break;
      const card = byIndex.get(pick.cardIndex);
      const word = card?.words[pick.wordIndex];
      if (!card || !word) continue;
      if (card.words.some((w) => w.highlight)) continue;
      if (!isHighlightable(word.text)) continue;
      word.highlight = true;
      spent++;
    }
  }
}
