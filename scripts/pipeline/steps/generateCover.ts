import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/edits";

interface OpenAiImageResponse {
  data?: { b64_json?: string }[];
}

async function extractFrame(localVideoPath: string, atSeconds: number): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cover-frame-"));
  const framePath = path.join(tempDir, "frame.png");
  try {
    await execFileAsync("ffmpeg", [
      "-ss",
      String(atSeconds),
      "-i",
      localVideoPath,
      "-frames:v",
      "1",
      "-y",
      framePath,
    ]);
    return await fs.readFile(framePath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// Extracts a frame of the creator's face from their own video, then composes
// it over an AI-generated background matching the video's topic via
// OpenAI's image edit endpoint (gpt-image-1).
export async function generateCoverImage(
  localVideoPath: string,
  topic: string
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const frame = await extractFrame(localVideoPath, 2);

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append(
    "prompt",
    `Vertical cover image for a short-form video about "${topic}". Keep the person ` +
      `from the reference photo clearly recognizable, composited naturally over a ` +
      `bold, high-contrast AI-generated background that visually matches the topic. ` +
      `Leave clear space in the upper third for overlay text. Punchy, scroll-stopping, ` +
      `optimized for click-through.`
  );
  form.append("size", "1024x1536");
  form.append("image", new Blob([new Uint8Array(frame)], { type: "image/png" }), "frame.png");

  const res = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`OpenAI image edit failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as OpenAiImageResponse;
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image response is missing b64_json");
  }
  return Buffer.from(b64, "base64");
}
