export type CaptionError = {
  before: string;
  wrong: string;
  right: string;
  after: string;
};

/** Real transcription errors from one real 10-minute video. Verbatim. */
export const captionErrors: CaptionError[] = [
  { before: "MARKETS OR", wrong: "MID CONSTRUCT", right: "SEMICONDUCTOR", after: "ECOSYSTEM" },
  { before: "THE YEN", wrong: "CARRIED IT", right: "CARRY TRADE", after: "THROUGHOUT" },
  { before: "TRY", wrong: "DEEP SIG", right: "DEEPSEEK", after: "V4" },
  { before: "FOR A", wrong: "CLORCODE", right: "CLAUDE CODE", after: "OR CODEX" },
  { before: "HISTORICAL", wrong: "GIT LOCK", right: "GITHUB", after: "COMMIT LOGS" },
  { before: "SWITCH TO", wrong: "OPEN RATES", right: "OPEN-WEIGHT", after: "MODELS" },
  { before: "CRISIS IN", wrong: "2000 YEAR", right: "2008", after: "" },
  { before: "THE", wrong: "YALE", right: "AI", after: "LABS" },
];

export const videoFacts = {
  minutes: 10,
  wordsSpoken: 2000,
  wordsCorrected: 37,
  captionCards: 641,
};
