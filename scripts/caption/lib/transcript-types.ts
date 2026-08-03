import type { Transcript, TranscriptWord } from "../../pipeline/lib/types";

// A superset of the pipeline's existing `Transcript`. The extra fields are
// optional there, so a `RichTranscript` is assignable to a `Transcript` and
// the hosted pipeline keeps working unchanged while gaining the better data.

export interface RichTranscriptWord extends TranscriptWord {
  /** "18,000" / "AI" -- what captions render. Falls back to `word`. */
  punctuatedWord: string;
  confidence?: number;
}

export interface Utterance {
  start: number;
  end: number;
}

export interface RichTranscript extends Transcript {
  words: RichTranscriptWord[];
  utterances: Utterance[];
}

const SENTENCE_END = /[.!?]["')\]]?$/;

/** True when this word closes a sentence, per its punctuation. */
export function endsSentence(word: RichTranscriptWord): boolean {
  return SENTENCE_END.test(word.punctuatedWord.trim());
}

export function endsClause(word: RichTranscriptWord): boolean {
  return /[,;:—-]$/.test(word.punctuatedWord.trim());
}
