import { endsClause, endsSentence, type RichTranscriptWord } from "../lib/transcript-types";

// Groups words into 3-4 word caption cards.
//
// This is deliberately deterministic. Asking an LLM to chunk the transcript
// is slow, non-reproducible between runs, and invites it to alter the words
// or invent timings -- and the rules that actually govern good captions
// (don't strand "the" at the end of a line, break where the speaker
// breathed) are mechanical.
//
// Within a sentence the split is chosen by dynamic programming rather than
// greedily. Greedy filling produces the classic failure where a sentence
// ends "...of the" / "market." -- it commits to a full first card and
// leaves the tail with no good options. DP costs the whole sentence at
// once, so a slightly short first card is accepted if it saves a bad break
// later.

export interface WordGroup {
  /** Indices into the original word array -- kept so highlights can refer back. */
  startIndex: number;
  words: RichTranscriptWord[];
}

const MAX_WORDS = 4;
const TARGET_WORDS = 3.4;
/** Above this a card starts wrapping or shrinking on a phone screen. */
const MAX_CHARS = 26;
const MIN_CARD_AUDIO_SEC = 0.35;
const MAX_CARD_AUDIO_SEC = 3.0;
/** An inter-word gap this long is an audible breath -- the best break there is. */
const BREATH_GAP_SEC = 0.18;
const SMALL_GAP_SEC = 0.08;

// Ending a card on one of these leaves the viewer hanging mid-phrase; the
// eye expects the noun that follows.
const TRAILING_STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "from", "with", "by",
  "into", "onto", "over", "under", "about", "as", "and", "or", "but", "nor",
  "so", "yet", "if", "than", "that", "which", "who", "whom", "whose", "this",
  "these", "those", "my", "your", "his", "her", "its", "our", "their",
  "is", "are", "was", "were", "be", "been", "being", "am", "has", "have",
  "had", "do", "does", "did", "will", "would", "can", "could", "should",
  "shall", "may", "might", "must", "not", "no", "very", "more", "most",
  // Pre-nominal modifiers: they promise a noun that has not arrived yet.
  "every", "each", "single", "same", "other", "another", "such", "own",
  "few", "many", "several", "certain", "entire", "whole", "main", "key",
  "next", "last", "first", "second", "big", "huge", "little", "real",
  // Bare subject pronouns. The possessives above were covered from the
  // start, but real speech strands these constantly -- "And currently, it"
  // followed by "is 100 times" was the worst break in the first real run.
  "it", "he", "she", "they", "we", "you", "i",
  // Quantifiers that head a phrase: "some kind of", "one of their models",
  // "all of the". Sentence-final uses ("...only one.") are exempt already,
  // since a card ending a sentence is never penalised.
  "one", "some", "any", "all", "both", "lot", "lots", "kind", "sort", "bunch",
]);

// Words that bind backwards onto a preceding number: "18,000 crores",
// "40 percent", "2 trillion". Splitting these reads as two unrelated cards.
const NUMBER_UNITS = new Set([
  "percent", "percentage", "crore", "crores", "lakh", "lakhs", "thousand",
  "million", "millions", "billion", "billions", "trillion", "trillions",
  "dollars", "dollar", "rupees", "euros", "pounds", "cents", "bucks",
  "years", "year", "months", "month", "weeks", "week", "days", "day",
  "hours", "hour", "minutes", "minute", "seconds", "second",
  "times", "x", "percent.", "bps", "basis",
]);

// Prepositions bind backwards onto the phrase they modify: breaking before
// "on" strands "...timeline" and opens the next card with "on Twitter".
const LEADING_BIND_BACK = new Set([
  "of", "in", "on", "at", "to", "for", "from", "with", "by", "into", "onto",
  "over", "under", "about", "than", "as",
]);

function normalize(word: RichTranscriptWord): string {
  return word.punctuatedWord.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "completely melting" -- an adverb modifies whatever comes next, so never end on one. */
function isAdverb(word: RichTranscriptWord): boolean {
  const n = normalize(word);
  return n.length > 4 && n.endsWith("ly");
}

/**
 * Short all-caps tokens ("AI", "GPU", "CEO") are almost always qualifying
 * the noun that follows -- "AI bubble", "GPU demand". Splitting them reads
 * as two unrelated cards.
 */
function isAcronym(word: RichTranscriptWord): boolean {
  const raw = word.punctuatedWord.replace(/[^A-Za-z]/g, "");
  return raw.length >= 2 && raw.length <= 4 && raw === raw.toUpperCase();
}

function containsDigit(word: RichTranscriptWord): boolean {
  return /\d/.test(word.punctuatedWord);
}

function isGlued(left: RichTranscriptWord, right: RichTranscriptWord): boolean {
  // A number and its unit, or a currency symbol and its amount.
  if (containsDigit(left) && NUMBER_UNITS.has(normalize(right))) return true;
  if (/^[$₹€£]$/.test(left.punctuatedWord.trim())) return true;
  return false;
}

function cardText(words: RichTranscriptWord[]): string {
  return words.map((w) => w.punctuatedWord).join(" ");
}

/**
 * Cost of making words[from..to) a single card, including the penalty for
 * breaking immediately after it. `Infinity` means structurally disallowed.
 */
function cardCost(words: RichTranscriptWord[], from: number, to: number): number {
  const slice = words.slice(from, to);
  const count = slice.length;
  const chars = cardText(slice).length;

  // A single very long word has nowhere else to go, so only reject
  // over-length cards that could actually have been split.
  if (count > 1 && chars > MAX_CHARS) return Infinity;

  let cost = (count - TARGET_WORDS) ** 2;

  if (count === 1) cost += 2.5;

  const duration = slice[count - 1].end - slice[0].start;
  if (duration < MIN_CARD_AUDIO_SEC) cost += 3;
  if (duration > MAX_CARD_AUDIO_SEC) cost += 2;

  const isSentenceEnd = to >= words.length;
  if (!isSentenceEnd) {
    const last = slice[count - 1];
    const next = words[to];

    // Break where the speaker paused: the caption change lands in silence
    // instead of stepping on a word.
    const gap = next.start - last.end;
    if (gap >= BREATH_GAP_SEC) cost -= 1.5;
    else if (gap >= SMALL_GAP_SEC) cost -= 0.5;

    if (endsClause(last)) cost -= 1.5;
    // Weighted above every other break penalty: a card ending on "the" or
    // "is" is the most conspicuous caption error there is, and it is always
    // worth an awkwardly-sized card elsewhere to avoid one.
    if (TRAILING_STOP_WORDS.has(normalize(last))) cost += 6;
    if (isGlued(last, next)) cost += 4;
    if (isAdverb(last)) cost += 3;
    if (isAcronym(last) && !isAcronym(next)) cost += 3;
    if (LEADING_BIND_BACK.has(normalize(next))) cost += 2.5;
  }

  return cost;
}

/** Split at sentence ends and at utterance boundaries -- both are hard breaks. */
function splitIntoSentences(
  words: RichTranscriptWord[],
  utteranceStarts: number[]
): { start: number; end: number }[] {
  const sentences: { start: number; end: number }[] = [];
  let start = 0;

  for (let i = 0; i < words.length; i++) {
    const isLast = i === words.length - 1;
    const nextOpensUtterance = !isLast && startsUtterance(words[i + 1].start, utteranceStarts);
    if (isLast || endsSentence(words[i]) || nextOpensUtterance) {
      sentences.push({ start, end: i + 1 });
      start = i + 1;
    }
  }
  return sentences;
}

/** Utterance starts rarely land exactly on a word start; match within a frame or two. */
function startsUtterance(wordStart: number, utteranceStarts: number[]): boolean {
  return utteranceStarts.some((u) => Math.abs(u - wordStart) <= 0.05);
}

function groupSentence(words: RichTranscriptWord[], offset: number): WordGroup[] {
  const n = words.length;
  if (n === 0) return [];

  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(-1);
  best[0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - MAX_WORDS); j < i; j++) {
      if (!Number.isFinite(best[j])) continue;
      const cost = cardCost(words, j, i);
      if (!Number.isFinite(cost)) continue;
      const total = best[j] + cost;
      if (total < best[i]) {
        best[i] = total;
        from[i] = j;
      }
    }
  }

  // Unreachable only if every window was rejected on length; fall back to a
  // flat chunking so one pathological sentence can't drop captions entirely.
  if (!Number.isFinite(best[n])) {
    const groups: WordGroup[] = [];
    for (let i = 0; i < n; i += MAX_WORDS) {
      groups.push({ startIndex: offset + i, words: words.slice(i, i + MAX_WORDS) });
    }
    return groups;
  }

  const groups: WordGroup[] = [];
  let i = n;
  while (i > 0) {
    const j = from[i];
    groups.unshift({ startIndex: offset + j, words: words.slice(j, i) });
    i = j;
  }
  return groups;
}

export function groupIntoCards(
  words: RichTranscriptWord[],
  utterances: { start: number }[] = []
): WordGroup[] {
  if (words.length === 0) return [];
  const utteranceStarts = utterances.map((u) => u.start);
  return splitIntoSentences(words, utteranceStarts).flatMap((s) =>
    groupSentence(words.slice(s.start, s.end), s.start)
  );
}
