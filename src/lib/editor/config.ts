import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// The transcript editor reads and writes files anywhere on the machine
// running the dev server. That is fine for a local tool and completely
// unacceptable on a deployed instance, so two independent controls apply:
//
//   1. The whole feature is disabled unless NODE_ENV is development.
//   2. Every path is resolved (following symlinks) and must land inside an
//      allowed root.
//
// Both are enforced in every route handler, not just in the UI.

const DEFAULT_ROOTS = [os.homedir(), "/mnt/c/Users"];

export class EditorAccessError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export function assertEditorEnabled(): void {
  if (process.env.NODE_ENV === "production") {
    throw new EditorAccessError("The transcript editor is only available in development.", 404);
  }
}

/** Colon-separated override, e.g. CAPTION_EDITOR_ROOTS=/mnt/c/Users/shash/Videos */
export function allowedRoots(): string[] {
  const configured = process.env.CAPTION_EDITOR_ROOTS;
  const roots = configured ? configured.split(":").filter(Boolean) : DEFAULT_ROOTS;
  return roots.map((r) => path.resolve(r));
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Resolves a caller-supplied path and rejects anything outside the allowed
 * roots. Uses realpath so a symlink cannot be used to escape a root.
 */
export async function resolveAllowedPath(
  input: string | null,
  extensions: string[]
): Promise<string> {
  assertEditorEnabled();
  if (!input) throw new EditorAccessError("Missing `file` parameter.", 400);

  const requested = path.resolve(input);
  let real: string;
  try {
    real = await fs.realpath(requested);
  } catch {
    throw new EditorAccessError(`File not found: ${requested}`, 404);
  }

  if (!allowedRoots().some((root) => isInside(real, root))) {
    throw new EditorAccessError(
      `Path is outside the allowed roots (${allowedRoots().join(", ")}). ` +
        "Set CAPTION_EDITOR_ROOTS to widen it.",
      403
    );
  }

  if (!extensions.some((ext) => real.toLowerCase().endsWith(ext))) {
    throw new EditorAccessError(`Expected one of ${extensions.join(", ")}: ${real}`, 400);
  }

  return real;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof EditorAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status: 500 });
}

/** Every edit document discovered under the allowed roots, newest first. */
export async function findEditDocuments(): Promise<{ path: string; modifiedAt: string }[]> {
  assertEditorEnabled();
  const found: { path: string; modifiedAt: string }[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Unreadable directory is not an error worth surfacing here.
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.name.endsWith(".edl.json")) {
        const stat = await fs.stat(full);
        found.push({ path: full, modifiedAt: stat.mtime.toISOString() });
      }
    }
  }

  for (const root of allowedRoots()) await walk(root, 0);
  return found.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}
