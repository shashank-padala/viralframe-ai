import type { RichTranscriptWord } from "../lib/transcript-types";

// A context-aware correction pass over the raw transcript.
//
// Speech-to-text reliably mangles the things a tech video is *about*:
// product names, company names, benchmarks, model versions. A real run
// produced "open terminal bench" (Terminal-Bench), "Anthropic Fable PHY",
// and lowercase "DeepSeek flash". Those errors are far more damaging in a
// burned-in caption than an ordinary word, because they are exactly what
// the viewer is reading for.
//
// The dangerous way to do this is to hand the transcript to a model and ask
// for a corrected version back: it silently rephrases, drops filler, merges
// sentences, and the word-to-timestamp alignment that the entire caption
// pipeline depends on is destroyed.
//
// So the model returns *targeted replacements addressed by index*, and every
// one is verified against the word actually at that index before it is
// applied. A correction that does not match is discarded, not guessed at.

const MODEL = "gpt-5.6-luna";
/** Words per request. Large enough for context, small enough to stay accurate. */
const CHUNK_SIZE = 350;
/** Overlap so a term spanning a chunk boundary is still seen whole. */
const CHUNK_OVERLAP = 25;
/**
 * A correction pass should touch a small fraction of the transcript. More
 * than this means the model started rewriting rather than correcting, and
 * the whole batch is rejected.
 */
const MAX_CORRECTION_RATIO = 0.12;

interface Correction {
  index: number;
  /**
   * How many consecutive words the correction replaces. Merges are the
   * common case for mangled names -- "deep sig" is two transcribed words
   * that should become one ("DeepSeek") -- and a single-word addressing
   * scheme cannot express that at all.
   */
  spanWords: number;
  from: string;
  to: string;
}

interface OpenAIResponse {
  choices?: { message?: { content?: string } }[];
}

export interface CorrectionOptions {
  /** Free context, e.g. the filename -- helps the model know the domain. */
  topicHint?: string;
  onWarn?: (message: string) => void;
  onProgress?: (message: string) => void;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function requestCorrections(
  numbered: { index: number; word: string }[],
  contextText: string,
  topicHint: string | undefined
): Promise<Correction[]> {
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
            "You correct speech-to-text errors in a video transcript.",
            "",
            "Fix ONLY these, and only when you are confident from context:",
            "- misheard proper nouns: company, product, person, benchmark and model names",
            "- wrong casing or spacing of a known name (deep seek flash -> DeepSeek Flash)",
            "- misheard technical terms and units",
            "",
            "Never do any of the following:",
            "- rephrase, reorder, or improve wording",
            "- fix grammar, remove filler words, or clean up false starts",
            "- change a word you merely think sounds informal",
            "- correct a word you cannot identify with confidence from the surrounding text",
            "",
            "Address each correction by the index of its first word plus `spanWords`, the",
            "number of consecutive words it replaces. `from` must be exactly those words joined",
            "by single spaces. `to` is the replacement and may have a different word count:",
            "",
            '  {"index": 41, "spanWords": 2, "from": "deep sig", "to": "DeepSeek"}',
            '  {"index": 88, "spanWords": 1, "from": "flash", "to": "Flash"}',
            '  {"index": 12, "spanWords": 3, "from": "open terminal bench", "to": "Terminal-Bench"}',
            "",
            "Return an empty list if nothing is clearly wrong.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            topic: topicHint ?? "unknown",
            passage: contextText,
            words: numbered,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "corrections",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["corrections"],
            properties: {
              corrections: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["index", "spanWords", "from", "to"],
                  properties: {
                    index: { type: "integer" },
                    spanWords: { type: "integer" },
                    from: { type: "string" },
                    to: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Correction pass failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Correction pass returned no content");
  return (JSON.parse(content) as { corrections?: Correction[] }).corrections ?? [];
}

/**
 * Replaces a run of words with the corrected text, redistributing the run's
 * combined time span across however many words come out. The run's outer
 * start and end are preserved exactly, so the correction cannot drift the
 * captions around it no matter how the word count changes.
 */
function replaceRun(run: RichTranscriptWord[], replacement: string): RichTranscriptWord[] {
  const tokens = replacement.trim().split(/\s+/).filter(Boolean);
  const first = run[0];
  const last = run[run.length - 1];
  if (tokens.length === 0) return run;

  // Trailing punctuation belongs to the position, not the word: if the last
  // word ended a sentence, the replacement has to keep doing so or sentence
  // detection downstream loses a boundary.
  const trailingPunctuation = /[.,!?;:]+$/.exec(last.punctuatedWord)?.[0] ?? "";

  const totalChars = tokens.reduce((sum, t) => sum + t.length, 0) || 1;
  const span = last.end - first.start;
  let cursor = first.start;

  return tokens.map((token, i) => {
    const start = cursor;
    cursor += (span * token.length) / totalChars;
    const isLast = i === tokens.length - 1;
    const text = isLast && trailingPunctuation && !/[.,!?;:]$/.test(token)
      ? token + trailingPunctuation
      : token;
    return {
      ...first,
      word: token.toLowerCase().replace(/[^a-z0-9']/g, ""),
      punctuatedWord: text,
      start,
      end: isLast ? last.end : cursor,
    };
  });
}

export async function correctTranscript(
  words: RichTranscriptWord[],
  options: CorrectionOptions = {}
): Promise<{ words: RichTranscriptWord[]; applied: number }> {
  if (words.length === 0) return { words, applied: 0 };

  // Collected across chunks and applied in one pass at the end, so indices
  // stay valid while corrections are still being gathered.
  const accepted = new Map<number, { span: number; to: string }>();
  const claimed = new Set<number>();

  for (let start = 0; start < words.length; start += CHUNK_SIZE) {
    const end = Math.min(words.length, start + CHUNK_SIZE);
    const contextStart = Math.max(0, start - CHUNK_OVERLAP);
    const contextEnd = Math.min(words.length, end + CHUNK_OVERLAP);

    const numbered = words
      .slice(start, end)
      .map((w, i) => ({ index: start + i, word: w.punctuatedWord }));
    const contextText = words
      .slice(contextStart, contextEnd)
      .map((w) => w.punctuatedWord)
      .join(" ");

    let corrections: Correction[];
    try {
      corrections = await requestCorrections(numbered, contextText, options.topicHint);
    } catch (error) {
      // A failed chunk leaves the original words in place; captions are
      // still correct, just not improved.
      options.onWarn?.(
        `correction chunk ${start}-${end} failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      continue;
    }

    for (const correction of corrections) {
      const span = Math.max(1, Math.min(4, correction.spanWords || 1));
      const run = words.slice(correction.index, correction.index + span);
      if (run.length !== span) continue;

      // Verify the model is addressing the words it thinks it is. Without
      // this, an off-by-one in its indexing would silently corrupt an
      // unrelated part of the transcript.
      const actual = run.map((w) => w.punctuatedWord).join(" ");
      if (normalize(correction.from) !== normalize(actual)) continue;

      const replacement = correction.to.trim();
      if (!replacement) continue;
      // Casing-only changes are legitimate ("flash" -> "Flash"), so compare
      // exactly rather than normalised when deciding it is a no-op.
      if (replacement === actual) continue;
      // Guard against a "correction" that is really a rewrite.
      if (replacement.split(/\s+/).length > 4) continue;
      // Two corrections covering the same word would apply twice; first wins.
      const indices = Array.from({ length: span }, (_, k) => correction.index + k);
      if (indices.some((i) => claimed.has(i))) continue;

      indices.forEach((i) => claimed.add(i));
      accepted.set(correction.index, { span, to: replacement });
    }
  }

  // Consistency sweep.
  //
  // The chunked pass is inconsistent by nature: the model catches "deep sig"
  // -> "DeepSeek" in one chunk and misses the same phrase two chunks later,
  // which is worse than never correcting it -- the same name is then spelled
  // two ways in one video. So every correction it did make becomes a rule,
  // applied deterministically everywhere else the identical phrase occurs.
  const glossary = new Map<string, { span: number; to: string }>();
  for (const [index, correction] of accepted) {
    const phrase = normalize(
      words
        .slice(index, index + correction.span)
        .map((w) => w.punctuatedWord)
        .join(" ")
    );
    // Short keys ("a", "one") would carpet the transcript; only apply a rule
    // globally when the phrase is distinctive enough to be safe.
    if (phrase.length < 4) continue;
    glossary.set(phrase, correction);
  }

  if (glossary.size > 0) {
    const spans = [...new Set([...glossary.values()].map((c) => c.span))].sort((a, b) => b - a);
    for (let i = 0; i < words.length; i++) {
      if (claimed.has(i)) continue;
      // Longest span first, so a two-word rule wins over a one-word rule
      // that would otherwise consume half of it.
      for (const span of spans) {
        const run = words.slice(i, i + span);
        if (run.length !== span) continue;
        const indices = Array.from({ length: span }, (_, k) => i + k);
        if (indices.some((k) => claimed.has(k))) continue;

        const rule = glossary.get(normalize(run.map((w) => w.punctuatedWord).join(" ")));
        if (!rule || rule.span !== span) continue;
        if (run.map((w) => w.punctuatedWord).join(" ") === rule.to) continue;

        indices.forEach((k) => claimed.add(k));
        accepted.set(i, rule);
        break;
      }
    }
  }

  if (claimed.size > words.length * MAX_CORRECTION_RATIO) {
    options.onWarn?.(
      `correction pass wanted to change ${claimed.size} of ${words.length} words ` +
        `(over ${Math.round(MAX_CORRECTION_RATIO * 100)}%); discarding as a likely rewrite`
    );
    return { words, applied: 0 };
  }

  const output: RichTranscriptWord[] = [];
  for (let i = 0; i < words.length; ) {
    const correction = accepted.get(i);
    if (!correction) {
      output.push(words[i]);
      i++;
      continue;
    }
    output.push(...replaceRun(words.slice(i, i + correction.span), correction.to));
    i += correction.span;
  }

  return { words: output, applied: accepted.size };
}
