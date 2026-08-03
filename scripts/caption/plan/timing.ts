import type { CaptionCard, CaptionWord } from "../edl";
import type { WordGroup } from "./group";

// Turns word-accurate groups into on-screen display windows.
//
// Word timings alone make bad captions. Three things have to be added:
//
// 1. Lead-in. A card that appears exactly on the first phoneme reads as
//    late, because the eye needs time to saccade to it before the word is
//    spoken. A frame or two early feels synchronised.
// 2. Bridging. Between two cards there is usually a 100-400ms gap. Left
//    alone the screen blinks empty between every phrase, which is the
//    single most amateur-looking caption artifact.
// 3. Floors. A card on screen for 150ms registers as a flicker, not text.

const LEAD_IN_SEC = 0.06;
/** Gaps up to here are bridged; past this the speaker has actually paused. */
const BRIDGE_GAP_SEC = 0.7;
/** How long a card lingers into a real pause before the screen clears. */
const MAX_HOLD_SEC = 1.0;
const MIN_DISPLAY_SEC = 0.5;

export function buildCards(groups: WordGroup[], sourceDurationSec: number): CaptionCard[] {
  const cards: CaptionCard[] = groups.map((group, index) => {
    const words: CaptionWord[] = group.words.map((w) => ({
      text: w.punctuatedWord,
      startSec: w.start,
      endSec: w.end,
      highlight: false,
    }));
    return {
      index,
      startSec: group.words[0].start,
      endSec: group.words[group.words.length - 1].end,
      words,
    };
  });

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const audioStart = card.words[0].startSec;
    const audioEnd = card.words[card.words.length - 1].endSec;
    const next = cards[i + 1];
    const nextAppears = next
      ? Math.max(0, next.words[0].startSec - LEAD_IN_SEC)
      : sourceDurationSec;

    const previousEnd = i > 0 ? cards[i - 1].endSec : 0;
    card.startSec = Math.max(previousEnd, Math.max(0, audioStart - LEAD_IN_SEC));

    const gap = nextAppears - audioEnd;
    if (gap <= BRIDGE_GAP_SEC) {
      // Hand straight off to the next card -- no empty frame between them.
      card.endSec = nextAppears;
    } else {
      card.endSec = Math.min(audioEnd + MAX_HOLD_SEC, nextAppears);
    }
    card.endSec = Math.min(card.endSec, sourceDurationSec);

    // Grouping already penalises short cards, but dense speech can still
    // produce one. Borrow from the following gap rather than shifting the
    // next card, which would desync it from its own audio.
    if (card.endSec - card.startSec < MIN_DISPLAY_SEC) {
      card.endSec = Math.min(card.startSec + MIN_DISPLAY_SEC, nextAppears, sourceDurationSec);
    }
    if (card.endSec <= card.startSec) {
      card.endSec = Math.min(card.startSec + 0.1, sourceDurationSec);
    }
  }

  return cards;
}
