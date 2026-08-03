export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  /**
   * Smart-formatted token ("18,000", "AI") rather than the raw lowercase
   * one. Optional so transcripts persisted before this field existed still
   * parse; consumers fall back to `word`.
   */
  punctuatedWord?: string;
  confidence?: number;
}

export interface Transcript {
  text: string;
  words: TranscriptWord[];
  /** Phrase boundaries from Deepgram's utterance segmentation. */
  utterances?: { start: number; end: number }[];
}

export interface HookVariation {
  label: "Bold" | "Curiosity" | "Controversial";
  hook: string;
}

export interface BrollScene {
  index: number;
  startSec: number;
  endSec: number;
  prompt: string;
}

export interface HooksAndScenesResult {
  hooks: HookVariation[];
  scenes: BrollScene[];
}
