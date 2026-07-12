export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface Transcript {
  text: string;
  words: TranscriptWord[];
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
