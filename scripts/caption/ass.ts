import { execFileSync } from "node:child_process";
import type { CaptionAlign, CaptionBand, EditDocument, PlacementSegment } from "./edl";

// Generates an ASS subtitle script from the edit document, so captions can
// be burned in by ffmpeg/libass instead of being rendered frame-by-frame
// through headless Chrome.
//
// Remotion screenshots a browser once per frame: measured at ~6.7fps on a
// 1080p source, which is ~95 minutes for a 10-minute 60fps video. libass
// composites text in the filter graph, so the encode becomes the only real
// cost -- the same job in single-digit minutes.
//
// The trade is fidelity: libass is not a browser. Everything the caption
// style actually uses maps over (weight, uppercase, thick outline, shadow,
// per-word colour, 9-way placement, a scale pop-in), but glyph
// rasterisation and easing will not be pixel-identical to the Remotion
// output. Remotion remains the editor preview and the reference renderer.

/**
 * ASS colours are &HAABBGGRR -- alpha first, then *blue, green, red*, the
 * reverse of hex CSS. Getting this backwards silently swaps red and blue,
 * which is the classic way to ship pink captions.
 */
function assColour(hex: string, alpha = 0): string {
  const value = hex.replace("#", "");
  const r = value.slice(0, 2);
  const g = value.slice(2, 4);
  const b = value.slice(4, 6);
  return `&H${alpha.toString(16).padStart(2, "0").toUpperCase()}${b}${g}${r}`.toUpperCase();
}

const WHITE = assColour("FFFFFF");
const YELLOW = assColour("FFD400");
const BLACK = assColour("000000");

interface AssStyle {
  uppercase: boolean;
  sizeRatio: number;
  /** 1 = outline + shadow, 3 = opaque box behind the text. */
  borderStyle: 1 | 3;
  outlineRatio: number;
  shadowRatio: number;
  backColour: string;
}

const STYLES: Record<string, AssStyle> = {
  hormozi: {
    uppercase: true,
    sizeRatio: 0.058,
    borderStyle: 1,
    outlineRatio: 0.055,
    shadowRatio: 0.02,
    backColour: assColour("000000", 0x80),
  },
  clean: {
    uppercase: false,
    sizeRatio: 0.05,
    borderStyle: 3,
    outlineRatio: 0.02,
    shadowRatio: 0,
    backColour: assColour("000000", 0x40),
  },
};

/** Numpad layout: 1-3 bottom, 4-6 middle, 7-9 top. */
function alignmentCode(band: CaptionBand, align: CaptionAlign): number {
  const column = align === "left" ? 1 : align === "right" ? 3 : 2;
  const row = band === "bottom" ? 0 : band === "center" ? 3 : 6;
  return row + column;
}

/**
 * libass has no "max width" -- text fills the space between the left and
 * right margins. So the 52% cap that keeps an off-centre card from growing
 * back across the zone it was placed to avoid is expressed as a deliberately
 * large opposite margin.
 */
function margins(width: number, align: CaptionAlign): { left: number; right: number } {
  const edge = Math.round(width * 0.05);
  if (align === "left") return { left: edge, right: Math.round(width * 0.43) };
  if (align === "right") return { left: Math.round(width * 0.43), right: edge };
  const centred = Math.round(width * 0.09);
  return { left: centred, right: centred };
}

function verticalMargin(height: number, band: CaptionBand): number {
  if (band === "bottom") return Math.round(height * 0.12);
  if (band === "top") return Math.round(height * 0.09);
  return 0;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  // Centisecond rounding can carry to 100; clamp rather than emit ".100".
  const centis = Math.min(99, cs);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

/** Braces open an override block in ASS, so they can never appear literally. */
function escapeText(text: string): string {
  return text.replace(/\\/g, "").replace(/[{}]/g, "");
}

function zoneAt(placement: PlacementSegment[], t: number): PlacementSegment | undefined {
  return placement.find((p) => t >= p.startSec && t < p.endSec) ?? placement[placement.length - 1];
}

/**
 * Prefers a font that is actually installed. libass resolves through
 * fontconfig, so naming a font that is not present silently falls back to a
 * default serif -- which looks nothing like the intended captions.
 */
export function pickFont(preferred: string[] = ["Montserrat Black", "Montserrat", "Lato Black", "Lato"]): string {
  for (const family of preferred) {
    try {
      const out = execFileSync("fc-list", [family, "family"], { encoding: "utf8" });
      if (out.trim().length > 0) return family;
    } catch {
      // fc-list missing or no match; try the next candidate.
    }
  }
  return "sans-serif";
}

export interface AssOptions {
  /** Shift all timings back by this many seconds, for a --range preview. */
  offsetSec?: number;
  /** Drop cards outside this window (in source time). */
  window?: [number, number];
  fontFamily?: string;
}

export function buildAss(edl: EditDocument, options: AssOptions = {}): string {
  const { width, height } = edl.source;
  const style = STYLES[edl.styleId] ?? STYLES.hormozi;
  const font = options.fontFamily ?? pickFont();
  const fontSize = Math.round(Math.min(width, height) * style.sizeRatio);
  const outline = +(fontSize * style.outlineRatio).toFixed(1);
  const shadow = +(fontSize * style.shadowRatio).toFixed(1);
  const offset = options.offsetSec ?? 0;

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    // Scale the outline with the resolution, so it matches what the
    // Remotion renderer draws at the same relative size.
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour," +
      " Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle," +
      " Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Bold is left off when the chosen family is already a heavy face --
    // asking for bold on top of Black makes libass synthesise a smeared
    // double-weight.
    `Style: Caption,${font},${fontSize},${WHITE},${YELLOW},${BLACK},${style.backColour},` +
      `${/black|heavy/i.test(font) ? 0 : 1},0,0,0,100,100,0,0,${style.borderStyle},` +
      `${outline},${shadow},2,${Math.round(width * 0.09)},${Math.round(width * 0.09)},` +
      `${Math.round(height * 0.12)},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const events: string[] = [];
  for (const card of edl.cards) {
    if (options.window) {
      const [from, to] = options.window;
      if (card.endSec <= from || card.startSec >= to) continue;
    }
    const start = card.startSec - offset;
    const end = card.endSec - offset;
    if (end <= 0) continue;

    const zone = zoneAt(edl.placement, card.startSec);
    const band = zone?.band ?? "bottom";
    const align = zone?.align ?? "center";
    const { left, right } = margins(width, align);

    const words = card.words
      .map((word) => {
        const text = escapeText(style.uppercase ? word.text.toUpperCase() : word.text);
        // Set the colour back explicitly rather than using \r, which would
        // also discard the alignment and animation overrides on this line.
        return word.highlight ? `{\\c${YELLOW}}${text}{\\c${WHITE}}` : text;
      })
      .join(" ");

    // Matches the composition: a 120ms scale-up from 88%, plus a short fade
    // so a card never hard-cuts onto the frame.
    const intro = `{\\an${alignmentCode(band, align)}\\fad(80,0)\\fscx88\\fscy88\\t(0,120,\\fscx100\\fscy100)}`;

    events.push(
      `Dialogue: 0,${formatTime(Math.max(0, start))},${formatTime(end)},Caption,,` +
        `${left},${right},${verticalMargin(height, band)},,${intro}${words}`
    );
  }

  return [...header, ...events, ""].join("\n");
}
