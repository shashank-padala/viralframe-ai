import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EDL_VERSION, type CaptionBand, type EditDocument } from "./edl";
import {
  assertFfmpegAvailable,
  burnSubtitles,
  extractAudioWav,
  hashSource,
  muxWithSourceAudio,
  probe,
} from "./lib/media";
import { buildAss, pickFont } from "./ass";
import { transcribeLocalAudio } from "./lib/deepgram";
import type { RichTranscript } from "./lib/transcript-types";
import { correctTranscript } from "./plan/correct";
import { groupIntoCards } from "./plan/group";
import { formatMetadata, generateMetadata } from "./plan/metadata";
import { buildCards } from "./plan/timing";
import { assignHighlights } from "./plan/keywords";
import { planPlacement } from "./placement";
import { renderCaptionedVideo } from "./stages/render";
import { buildSrt } from "./srt";
import { wholeVideo } from "./timeline";

// Local end-to-end captioning: video in, YouTube-ready video out.
//
//   npx tsx scripts/caption/cli.ts "<input.mp4>" [options]
//
// Runs the analysis stages into an edit document (`<name>.edl.json`) and
// then renders from it. Re-running reuses a cached transcript for the same
// source file, and `--from-edl` skips analysis entirely -- iterating on the
// caption look should not re-pay for transcription or the vision pass.

/**
 * The hosted pipeline gets its keys from GitHub Actions secrets; running
 * locally there is nothing to inject them, so read .env.local the same way
 * `next dev` would. Existing environment variables always win.
 */
async function loadEnvLocal(): Promise<void> {
  let contents: string;
  try {
    contents = await fsp.readFile(path.join(process.cwd(), ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of contents.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

interface Options {
  input: string;
  output?: string;
  style: string;
  band?: CaptionBand;
  range?: [number, number];
  fromEdl: boolean;
  noVision: boolean;
  noLlm: boolean;
  noCorrect: boolean;
  metadata: boolean;
  planOnly: boolean;
  engine: "ass" | "remotion";
}

function parseArgs(argv: string[]): Options {
  const [input, ...rest] = argv;
  if (!input || input.startsWith("--")) {
    throw new Error('Usage: npx tsx scripts/caption/cli.ts "<input.mp4>" [--out <file>] [--range 0:60]');
  }

  const options: Options = {
    input,
    style: "hormozi",
    fromEdl: false,
    noVision: false,
    noLlm: false,
    noCorrect: false,
    metadata: false,
    planOnly: false,
    engine: "ass",
  };

  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    const value = rest[i + 1];
    switch (flag) {
      case "--out":
        options.output = value;
        i++;
        break;
      case "--style":
        options.style = value;
        i++;
        break;
      case "--band":
        if (value !== "top" && value !== "center" && value !== "bottom") {
          throw new Error("--band must be one of: top, center, bottom");
        }
        options.band = value;
        i++;
        break;
      case "--range": {
        const [from, to] = (value ?? "").split(":").map(Number);
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
          throw new Error("--range expects <startSec>:<endSec>, e.g. --range 0:60");
        }
        options.range = [from, to];
        i++;
        break;
      }
      case "--from-edl":
        options.fromEdl = true;
        break;
      case "--no-vision":
        options.noVision = true;
        break;
      case "--no-llm":
        options.noLlm = true;
        break;
      case "--no-correct":
        options.noCorrect = true;
        break;
      case "--metadata":
        options.metadata = true;
        break;
      case "--plan-only":
        options.planOnly = true;
        break;
      case "--engine":
        if (value !== "ass" && value !== "remotion") {
          throw new Error("--engine must be one of: ass, remotion");
        }
        options.engine = value;
        i++;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }
  return options;
}

const log = (message: string) => console.log(`[caption] ${message}`);
const warn = (message: string) => console.warn(`[caption] WARN ${message}`);

function edlPath(input: string): string {
  return path.join(path.dirname(input), `${path.parse(input).name}.edl.json`);
}

function cachePath(hash: string): string {
  return path.join(os.tmpdir(), `viralframe-transcript-${hash}.json`);
}

async function getTranscript(sourcePath: string, hash: string): Promise<RichTranscript> {
  const cached = cachePath(hash);
  try {
    const raw = await fsp.readFile(cached, "utf8");
    log("reusing cached transcript");
    return JSON.parse(raw) as RichTranscript;
  } catch {
    // Cache miss is the normal first-run path, not an error.
  }

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "viralframe-caption-"));
  try {
    log("extracting audio");
    const wav = await extractAudioWav(sourcePath, path.join(workDir, "audio.wav"));
    log("transcribing (Deepgram nova-3)");
    const transcript = await transcribeLocalAudio(wav);
    await fsp.writeFile(cached, JSON.stringify(transcript));
    return transcript;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Cached separately from the raw Deepgram result so the two stages can be
 * invalidated independently -- changing the correction prompt should not
 * re-charge for transcription.
 */
async function getCorrectedTranscript(
  transcript: RichTranscript,
  hash: string,
  topicHint: string
): Promise<RichTranscript> {
  const cached = path.join(os.tmpdir(), `viralframe-corrected-${hash}.json`);
  try {
    const parsed = JSON.parse(await fsp.readFile(cached, "utf8")) as RichTranscript;
    log("reusing cached transcript corrections");
    return parsed;
  } catch {
    // Cache miss is the normal first-run path.
  }

  log("correcting names and terms");
  const { words, applied } = await correctTranscript(transcript.words, {
    // The filename is usually a decent statement of the topic, and it costs
    // nothing to pass along.
    topicHint: topicHint.replace(/[-_]+/g, " "),
    onWarn: warn,
  });
  log(`${applied} word(s) corrected`);

  const corrected: RichTranscript = { ...transcript, words };
  await fsp.writeFile(cached, JSON.stringify(corrected));
  return corrected;
}

async function buildEdl(options: Options): Promise<EditDocument> {
  const source = await probe(options.input);
  log(
    `source: ${source.width}x${source.height} @ ${source.fps.toFixed(3)}fps, ` +
      `${source.durationSec.toFixed(1)}s, audio=${source.hasAudio}`
  );

  const sourceHash = await hashSource(options.input);
  const raw = await getTranscript(options.input, sourceHash);
  log(`${raw.words.length} words, ${raw.utterances.length} utterances`);

  const transcript = options.noCorrect
    ? raw
    : await getCorrectedTranscript(raw, sourceHash, path.parse(options.input).name);

  const groups = groupIntoCards(transcript.words, transcript.utterances);
  const cards = buildCards(groups, source.durationSec);
  log(`${cards.length} caption cards planned`);

  await assignHighlights(cards, { deterministicOnly: options.noLlm, onWarn: warn });
  const highlighted = cards.filter((c) => c.words.some((w) => w.highlight)).length;
  log(`${highlighted} of ${cards.length} cards highlighted`);

  // Skipping the vision pass should skip a *cost*, not silently discard a
  // placement decision that was already made and paid for. If a previous
  // edit document exists, carry its placement forward rather than resetting
  // to a default that may be worse.
  let placement: EditDocument["placement"] | undefined;
  if (options.noVision && !options.band) {
    try {
      const previous = JSON.parse(
        await fsp.readFile(edlPath(options.input), "utf8")
      ) as EditDocument;
      if (previous.placement?.length) {
        placement = previous.placement;
        log(`--no-vision: keeping existing placement (${placement.map((p) => `${p.band}/${p.align ?? "center"}`).join(", ")})`);
      }
    } catch {
      // No previous document; fall through to the default below.
    }
  }

  placement ??= await planPlacement(source, {
    fixedBand: options.noVision ? "bottom" : options.band,
    onWarn: warn,
    onProgress: log,
  });
  log(`placement: ${placement.map((p) => `${p.band}@${p.startSec.toFixed(1)}s`).join(", ")}`);

  return {
    version: EDL_VERSION,
    createdAt: new Date().toISOString(),
    source,
    sourceHash,
    cards,
    placement,
    keep: wholeVideo(source.durationSec),
    styleId: options.style,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await loadEnvLocal();
  await assertFfmpegAvailable();

  const editPath = edlPath(options.input);
  let edl: EditDocument;

  if (options.fromEdl) {
    edl = JSON.parse(await fsp.readFile(editPath, "utf8")) as EditDocument;
    // The style is a render-time concern, so honour the flag over the
    // stored value -- that is the whole point of iterating from an EDL.
    edl.styleId = options.style;
    log(`loaded edit document from ${editPath}`);
  } else {
    edl = await buildEdl(options);
    await fsp.writeFile(editPath, JSON.stringify(edl, null, 2));
    log(`wrote ${editPath}`);

    const srtPath = path.join(path.dirname(options.input), `${path.parse(options.input).name}.srt`);
    // The sidecar must carry the same corrected names as the burned-in
    // captions, so it reads from the corrected transcript (cached by now,
    // so this costs a file read) rather than the raw Deepgram output.
    const raw = await getTranscript(options.input, edl.sourceHash);
    const transcript = options.noCorrect
      ? raw
      : await getCorrectedTranscript(raw, edl.sourceHash, path.parse(options.input).name);
    await fsp.writeFile(srtPath, buildSrt(transcript.words));
    log(`wrote ${srtPath}`);

    if (options.metadata) {
      log("writing YouTube title and description");
      const metaPath = path.join(
        path.dirname(options.input),
        `${path.parse(options.input).name}-youtube.txt`
      );
      try {
        const meta = await generateMetadata(transcript.words, path.parse(options.input).name);
        await fsp.writeFile(metaPath, formatMetadata(meta));
        log(`wrote ${metaPath}`);
      } catch (error) {
        // Packaging copy is a bonus artifact; never fail a render over it.
        warn(`metadata generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (options.planOnly) {
    log("--plan-only: stopping before render");
    return;
  }

  const suffix = options.range ? `-preview-${options.range[0]}-${options.range[1]}` : "-captioned";
  const outputPath =
    options.output ??
    path.join(path.dirname(options.input), `${path.parse(options.input).name}${suffix}.mp4`);

  if (options.engine === "ass") {
    const font = pickFont();
    const assPath = path.join(os.tmpdir(), `viralframe-${edl.sourceHash}.ass`);
    // Timings are shifted rather than relying on ffmpeg to offset them, so
    // input-side (fast) seeking stays in step with the subtitles.
    await fsp.writeFile(
      assPath,
      buildAss(edl, {
        offsetSec: options.range?.[0] ?? 0,
        window: options.range,
        fontFamily: font,
      })
    );
    log(`burning captions with libass (font: ${font})`);
    const started = Date.now();
    await burnSubtitles({
      videoPath: edl.source.path,
      assPath,
      outPath: outputPath,
      range: options.range,
    });
    log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s: ${outputPath}`);
    return;
  }

  const frameRange: [number, number] | undefined = options.range
    ? [
        Math.floor(options.range[0] * edl.source.fps),
        Math.max(
          Math.floor(options.range[0] * edl.source.fps),
          Math.min(
            Math.floor(options.range[1] * edl.source.fps),
            Math.round(edl.source.durationSec * edl.source.fps) - 1
          )
        ),
      ]
    : undefined;

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "viralframe-render-"));
  try {
    const silentPath = path.join(workDir, "video.mp4");
    log(frameRange ? `rendering frames ${frameRange[0]}-${frameRange[1]}` : "rendering");

    let lastLogged = -1;
    await renderCaptionedVideo(edl, {
      outputPath: silentPath,
      frameRange,
      onProgress: (percent) => {
        if (percent >= lastLogged + 10) {
          lastLogged = percent;
          log(`render ${percent}%`);
        }
      },
    });

    if (edl.source.hasAudio) {
      log("muxing source audio");
      await muxWithSourceAudio({
        videoPath: silentPath,
        audioSourcePath: edl.source.path,
        audioOffsetSec: options.range?.[0] ?? 0,
        outPath: outputPath,
      });
    } else {
      await fsp.copyFile(silentPath, outputPath);
    }
    log(`done: ${outputPath}`);
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[caption] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
