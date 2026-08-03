// Real corrections from a real 10-minute video, taken by diffing the raw
// Deepgram output against the transcript after the context-correction pass.
//
// These are deliberately not invented. The whole argument of the page is
// that other tools ship these errors and you fix them by hand, so the
// examples have to be things that actually happened -- "mid construct" for
// "semiconductor" is not a hypothetical, it is what the recogniser
// produced.
//
// Each entry is shaped like a real caption card: 3-4 words, with the
// corrected term carrying the highlight, exactly as the renderer would
// draw it.

export interface Correction {
  /** Words before the mistake, for context. */
  before: string[];
  /** What the recogniser heard. */
  wrong: string;
  /** What was actually said. */
  right: string;
  /** Words after. */
  after: string[];
}

export const HERO_CORRECTIONS: Correction[] = [
  // Leads because it needs no explanation -- everyone can hear how
  // "semiconductor" becomes "mid construct", and the result is nonsense.
  { before: ["MARKETS", "OR"], wrong: "MID CONSTRUCT", right: "SEMICONDUCTOR", after: ["ECOSYSTEM"] },
  { before: ["THE", "YEN"], wrong: "CARRIED IT", right: "CARRY TRADE", after: ["THROUGHOUT"] },
  { before: ["TRY"], wrong: "DEEP SIG", right: "DEEPSEEK", after: ["V", "FOUR"] },
  { before: ["FOR", "A"], wrong: "CLORCODE", right: "CLAUDE CODE", after: ["OR", "CODEX"] },
  { before: ["LIKE,"], wrong: "BIG BIT", right: "BYBIT", after: ["CRASH"] },
  { before: ["HISTORICAL"], wrong: "GIT LOCK", right: "GITHUB", after: ["COMMIT", "LOGS"] },
  { before: ["SWITCH", "TO"], wrong: "OPEN RATES", right: "OPEN-WEIGHT", after: ["MODELS"] },
  { before: ["CRISIS", "IN"], wrong: "2000 YEAR", right: "2008", after: [] },
  { before: ["AS", "GOOD", "AS"], wrong: "OPUS FIVE", right: "OPUS 4.5", after: [] },
  { before: ["THE"], wrong: "YALE", right: "AI", after: ["LABS"] },
];

/** How many the correction pass fixed in that one video, for the caption line. */
export const TOTAL_CORRECTIONS = 37;
