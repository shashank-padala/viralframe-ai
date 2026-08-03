import type { CaptionCard } from "../../../scripts/caption/edl";

/**
 * Applies a text edit to one word of a card.
 *
 * Splitting the input on whitespace lets a single field cover all three
 * corrections that actually come up:
 *
 *   "Nvidia" -> "NVIDIA"      replace a mis-heard word
 *   "um"     -> ""            delete one the transcriber invented
 *   "gonna"  -> "going to"    split one token into the words really spoken
 *
 * Timings are never recomputed from scratch: a corrected word is spoken at
 * exactly the moment the wrong one was. A split divides the original span
 * between the fragments in proportion to their length, which is a better
 * approximation than an even split for the common "a-long-word plus a short
 * one" case.
 */
export function applyWordEdit(card: CaptionCard, wordIndex: number, raw: string): CaptionCard {
  const original = card.words[wordIndex];
  if (!original) return card;

  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const words = [...card.words];

  if (tokens.length === 0) {
    words.splice(wordIndex, 1);
  } else if (tokens.length === 1) {
    words[wordIndex] = { ...original, text: tokens[0] };
  } else {
    const span = original.endSec - original.startSec;
    const totalChars = tokens.reduce((sum, t) => sum + t.length, 0) || 1;
    let cursor = original.startSec;
    const replacements = tokens.map((token, i) => {
      const startSec = cursor;
      cursor += (span * token.length) / totalChars;
      return {
        text: token,
        startSec,
        // Pin the final fragment to the original end so floating-point
        // accumulation cannot leave a sliver of a gap before the next word.
        endSec: i === tokens.length - 1 ? original.endSec : cursor,
        // A card carries at most one highlight, so only the first fragment
        // can inherit it.
        highlight: i === 0 ? original.highlight : false,
      };
    });
    words.splice(wordIndex, 1, ...replacements);
  }

  return { ...card, words };
}

/**
 * Sets the highlight on one word, clearing any other in the same card, or
 * clears it if that word already had it. The renderer assumes at most one
 * highlight per card and this is the only thing that enforces it.
 */
export function toggleHighlight(card: CaptionCard, wordIndex: number): CaptionCard {
  const wasHighlighted = card.words[wordIndex]?.highlight ?? false;
  return {
    ...card,
    words: card.words.map((word, i) => ({ ...word, highlight: !wasHighlighted && i === wordIndex })),
  };
}
