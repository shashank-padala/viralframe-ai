import fs from "node:fs/promises";
import type { NextRequest } from "next/server";
import { errorResponse, resolveAllowedPath } from "@/lib/editor/config";
import { activeJobFor, getJob, startRender } from "@/lib/editor/render-jobs";
import type { EditDocument } from "../../../../../scripts/caption/edl";

/** Poll for progress: ?job=<id>, or ?file=<edl> to pick up a render already in flight. */
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("job");
    if (jobId) {
      const job = getJob(jobId);
      if (!job) return Response.json({ error: "Unknown job" }, { status: 404 });
      return Response.json({ job });
    }

    const file = await resolveAllowedPath(request.nextUrl.searchParams.get("file"), [".edl.json"]);
    return Response.json({ job: activeJobFor(file) ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const edlPath = await resolveAllowedPath(request.nextUrl.searchParams.get("file"), [".edl.json"]);
    const body = (await request.json()) as { range?: [number, number] };

    // Take the source path from the saved document rather than the request,
    // so a render can only ever target the file the document already names.
    const edl = JSON.parse(await fs.readFile(edlPath, "utf8")) as EditDocument;
    const sourcePath = await resolveAllowedPath(edl.source.path, [".mp4", ".mov", ".webm", ".mkv"]);

    let range: [number, number] | undefined;
    if (body.range) {
      const [from, to] = body.range;
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
        return Response.json({ error: "range must be [start, end] in seconds" }, { status: 400 });
      }
      range = [Math.max(0, from), Math.min(to, edl.source.durationSec)];
    }

    const job = startRender({ edlPath, sourcePath, range });
    return Response.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}
