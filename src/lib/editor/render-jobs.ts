import { spawn } from "node:child_process";
import path from "node:path";

// Tracks CLI renders started from the editor.
//
// A long-form render is minutes to an hour, which is far too long to hold a
// streaming HTTP response open. So the job runs detached from the request
// that started it, output accumulates here, and the client polls. The
// registry lives in module scope, which in the dev server means it survives
// across requests but not across a server restart -- a restart loses the log
// while the render itself keeps going, which is the right trade for a local
// tool.

export type JobStatus = "running" | "succeeded" | "failed";

export interface RenderJob {
  id: string;
  edlPath: string;
  status: JobStatus;
  lines: string[];
  startedAt: number;
  finishedAt?: number;
  outputPath?: string;
}

const jobs = new Map<string, RenderJob>();
/** One render at a time per document -- they would fight over the output file. */
const activeByEdl = new Map<string, string>();

const MAX_LINES = 500;

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function activeJobFor(edlPath: string): RenderJob | undefined {
  const id = activeByEdl.get(edlPath);
  return id ? jobs.get(id) : undefined;
}

export interface StartRenderOptions {
  edlPath: string;
  sourcePath: string;
  /** Render only this window, in seconds. Omitted renders the whole video. */
  range?: [number, number];
}

export function startRender(options: StartRenderOptions): RenderJob {
  const existing = activeJobFor(options.edlPath);
  if (existing && existing.status === "running") return existing;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const args = [
    "tsx",
    "scripts/caption/cli.ts",
    options.sourcePath,
    // The editor has just saved the document, so never re-run the paid
    // analysis stages -- render exactly what is on screen.
    "--from-edl",
  ];
  if (options.range) args.push("--range", `${options.range[0]}:${options.range[1]}`);

  const job: RenderJob = {
    id,
    edlPath: options.edlPath,
    status: "running",
    lines: [`$ npx ${args.join(" ")}`],
    startedAt: Date.now(),
  };
  jobs.set(id, job);
  activeByEdl.set(options.edlPath, id);

  const child = spawn("npx", args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const append = (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      job.lines.push(trimmed);
      // The CLI prints the destination on success; surface it so the UI can
      // name the file rather than making the user read the log.
      const match = /^\[caption\] done: (.+)$/.exec(trimmed);
      if (match) job.outputPath = match[1];
    }
    if (job.lines.length > MAX_LINES) job.lines.splice(0, job.lines.length - MAX_LINES);
  };

  child.stdout.on("data", append);
  child.stderr.on("data", append);

  child.on("error", (error) => {
    job.lines.push(`failed to start: ${error.message}`);
    job.status = "failed";
    job.finishedAt = Date.now();
    activeByEdl.delete(options.edlPath);
  });

  child.on("close", (code) => {
    job.status = code === 0 ? "succeeded" : "failed";
    job.finishedAt = Date.now();
    activeByEdl.delete(options.edlPath);
  });

  return job;
}

/** Strips the repo prefix so the UI can show a short, readable output name. */
export function displayPath(fullPath: string): string {
  return path.basename(fullPath);
}
