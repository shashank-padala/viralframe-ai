import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { SourceMeta } from "../edl";

const execFileAsync = promisify(execFile);

// ffmpeg writes progress to stderr and can produce a lot of it on a long
// video, so give every call plenty of buffer rather than debugging a
// truncated-output crash later.
const BIG_BUFFER = 64 * 1024 * 1024;

async function ffmpeg(args: string[]): Promise<string> {
  const { stderr } = await execFileAsync("ffmpeg", ["-hide_banner", "-nostdin", ...args], {
    maxBuffer: BIG_BUFFER,
  });
  return stderr;
}

export async function assertFfmpegAvailable(): Promise<void> {
  try {
    await execFileAsync("ffprobe", ["-version"]);
    await execFileAsync("ffmpeg", ["-version"]);
  } catch {
    throw new Error(
      "ffmpeg/ffprobe not found on PATH. Install them first (Ubuntu/WSL: sudo apt-get install -y ffmpeg)."
    );
  }
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string };
}

function parseFrameRate(value: string | undefined): number | null {
  if (!value) return null;
  const [num, den] = value.split("/").map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  const fps = num / den;
  return fps > 0 && fps < 1000 ? fps : null;
}

export async function probe(filePath: string): Promise<SourceMeta> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    { maxBuffer: BIG_BUFFER }
  );
  const data = JSON.parse(stdout) as FfprobeOutput;

  const video = data.streams?.find((s) => s.codec_type === "video");
  if (!video?.width || !video.height) {
    throw new Error(`No video stream found in ${filePath}`);
  }
  const durationSec = parseFloat(data.format?.duration ?? "");
  if (!Number.isFinite(durationSec)) {
    throw new Error(`Could not determine duration of ${filePath}`);
  }

  // Prefer avg_frame_rate: r_frame_rate reports the *timebase* tick rate,
  // which for a variable-frame-rate screen recording is often a wildly high
  // nominal value (1000fps) rather than the real capture rate.
  const fps = parseFrameRate(video.avg_frame_rate) ?? parseFrameRate(video.r_frame_rate) ?? 30;

  return {
    path: path.resolve(filePath),
    durationSec,
    width: video.width,
    height: video.height,
    fps,
    hasAudio: Boolean(data.streams?.some((s) => s.codec_type === "audio")),
  };
}

/**
 * Hash of the first and last 8 MB plus the file size. A full hash of a
 * multi-GB video costs more than the transcription it is meant to cache.
 */
export async function hashSource(filePath: string): Promise<string> {
  const CHUNK = 8 * 1024 * 1024;
  const { size } = await fsp.stat(filePath);
  const hash = crypto.createHash("sha256").update(String(size));
  const handle = await fsp.open(filePath, "r");
  try {
    const head = Buffer.alloc(Math.min(CHUNK, size));
    await handle.read(head, 0, head.length, 0);
    hash.update(head);
    if (size > CHUNK) {
      const tailLength = Math.min(CHUNK, size - CHUNK);
      const tail = Buffer.alloc(tailLength);
      await handle.read(tail, 0, tailLength, size - tailLength);
      hash.update(tail);
    }
  } finally {
    await handle.close();
  }
  return hash.digest("hex").slice(0, 16);
}

/** 16 kHz mono WAV -- what Deepgram wants, and what silence detection will want in Phase 2. */
export async function extractAudioWav(videoPath: string, outPath: string): Promise<string> {
  await ffmpeg(["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outPath]);
  return outPath;
}

/**
 * Shot boundaries via ffmpeg's scene-change score. Returns source-time
 * seconds of each cut (not including 0).
 */
export async function detectShotBoundaries(videoPath: string, threshold = 0.3): Promise<number[]> {
  const stderr = await ffmpeg([
    "-i",
    videoPath,
    "-filter:v",
    `select='gt(scene,${threshold})',showinfo`,
    "-an",
    "-f",
    "null",
    "-",
  ]);
  const times = [...stderr.matchAll(/pts_time:([0-9.]+)/g)]
    .map((m) => parseFloat(m[1]))
    .filter((t) => Number.isFinite(t) && t > 0);
  return [...new Set(times)].sort((a, b) => a - b);
}

/** Single JPEG at a given timestamp, downscaled -- these only feed a vision model. */
export async function extractFrame(
  videoPath: string,
  atSec: number,
  outPath: string,
  width = 768
): Promise<string> {
  await ffmpeg([
    "-y",
    // -ss before -i seeks by keyframe, which is orders of magnitude faster
    // on a long file and plenty accurate for a representative frame.
    "-ss",
    atSec.toFixed(3),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${width}:-2`,
    "-q:v",
    "5",
    outPath,
  ]);
  return outPath;
}

/**
 * Mux a rendered (silent) video track with audio taken straight from the
 * source. Copying rather than re-encoding keeps the audio bit-identical and
 * is far faster than letting Remotion round-trip it.
 */
export async function muxWithSourceAudio(opts: {
  videoPath: string;
  audioSourcePath: string;
  audioOffsetSec: number;
  outPath: string;
}): Promise<void> {
  const args = ["-y", "-i", opts.videoPath];
  if (opts.audioOffsetSec > 0) args.push("-ss", opts.audioOffsetSec.toFixed(3));
  args.push("-i", opts.audioSourcePath, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy");
  // A full render keeps the source audio bit-identical. A --range preview
  // has to seek, and a stream copy can only cut on a packet boundary, so it
  // re-encodes to land the offset exactly -- preview fidelity is not the
  // thing being evaluated there.
  if (opts.audioOffsetSec > 0) {
    args.push("-c:a", "aac", "-b:a", "192k");
  } else {
    args.push("-c:a", "copy");
  }
  args.push(
    // Stop at whichever stream ends first so a rounding difference between
    // the rendered frame count and the audio length can't leave a tail of
    // black frames or silence.
    "-shortest",
    "-movflags",
    "+faststart",
    opts.outPath
  );
  await ffmpeg(args);
}

export interface BurnOptions {
  videoPath: string;
  assPath: string;
  outPath: string;
  /** Source-time window to encode. Subtitle timings must already be shifted to match. */
  range?: [number, number];
  crf?: number;
  /** Hardware encoder name, e.g. "h264_nvenc". Falls back to libx264 on failure. */
  encoder?: string;
  onProgress?: (line: string) => void;
}

/**
 * Burns captions with libass in a single ffmpeg pass.
 *
 * This replaces a frame-by-frame browser render for the common case. Audio
 * is stream-copied, so only the video is re-encoded -- unavoidable for
 * burn-in, but an order of magnitude cheaper than screenshotting a page per
 * frame.
 */
export async function burnSubtitles(options: BurnOptions): Promise<void> {
  const args = ["-y"];
  // Input-side seeking is the fast one; the caller shifts subtitle timings
  // by the same offset so the two stay aligned.
  if (options.range) {
    args.push("-ss", options.range[0].toFixed(3));
  }
  args.push("-i", options.videoPath);
  if (options.range) {
    args.push("-t", (options.range[1] - options.range[0]).toFixed(3));
  }

  // libass reads the file through a filter argument, where ':' separates
  // options and '\' escapes -- so the path has to be escaped, not just quoted.
  const escaped = options.assPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
  args.push(
    "-vf",
    `ass='${escaped}'`,
    "-c:v",
    options.encoder ?? "libx264",
    "-preset",
    "veryfast",
    "-crf",
    String(options.crf ?? 18),
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    options.outPath
  );

  await ffmpeg(args);
}

/** Copy the video track through with no audio (used when the source is silent). */
export async function finalizeVideoOnly(videoPath: string, outPath: string): Promise<void> {
  await ffmpeg(["-y", "-i", videoPath, "-c", "copy", "-movflags", "+faststart", outPath]);
}

export function fileExists(p: string): boolean {
  return fs.existsSync(p);
}
