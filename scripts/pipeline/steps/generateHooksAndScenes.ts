import type { HooksAndScenesResult, Transcript } from "../lib/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5.4-nano";

const HOOKS_AND_SCENES_SCHEMA = {
  name: "hooks_and_scenes",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      hooks: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string", enum: ["Bold", "Curiosity", "Controversial"] },
            hook: { type: "string" },
          },
          required: ["label", "hook"],
        },
      },
      scenes: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            index: { type: "integer" },
            startSec: { type: "number" },
            endSec: { type: "number" },
            prompt: { type: "string" },
          },
          required: ["index", "startSec", "endSec", "prompt"],
        },
      },
    },
    required: ["hooks", "scenes"],
  },
} as const;

const SYSTEM_PROMPT = `You write short-form video hooks and b-roll scene prompts from a
talking-head video transcript with word-level timestamps.

Produce exactly 3 hooks (Bold, Curiosity, Controversial), each under 12 words, punchy,
written to stop a scroll.

Split the transcript into 3-6 topical beats covering its full duration. For each beat,
write a short (5-15 word) visual prompt describing concrete footage an AI video model
should generate to play behind that portion of speech -- specific and visual (e.g. "a
hand typing on a laptop keyboard, close up, warm lighting"), never abstract or referring
to the speaker.`;

interface OpenAiChatResponse {
  choices?: { message?: { content?: string } }[];
}

export async function generateHooksAndScenes(
  title: string,
  transcript: Transcript
): Promise<HooksAndScenesResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const wordsWithTimes = transcript.words
    .map((w) => `[${w.start.toFixed(1)}s] ${w.word}`)
    .join(" ");

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Video title: ${title}\n\nTranscript with word timestamps:\n${wordsWithTimes}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: HOOKS_AND_SCENES_SCHEMA },
    }),
  });

  if (!res.ok) {
    throw new Error(
      `OpenAI hooks/scenes generation failed: ${res.status} ${await res.text()}`
    );
  }

  const data = (await res.json()) as OpenAiChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response is missing message content");
  }

  return JSON.parse(content) as HooksAndScenesResult;
}
