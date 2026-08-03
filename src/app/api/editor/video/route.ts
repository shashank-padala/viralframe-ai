import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { errorResponse, resolveAllowedPath } from "@/lib/editor/config";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
};

/**
 * Streams the source video to the editor's <video> element.
 *
 * Range support is not optional here: without a 206 response the browser
 * downloads the whole file before it can play and cannot seek at all, which
 * makes scrubbing to a word -- the entire point of the editor -- impossible
 * on a multi-hundred-megabyte recording.
 */
export async function GET(request: NextRequest) {
  try {
    const file = await resolveAllowedPath(
      request.nextUrl.searchParams.get("file"),
      Object.keys(MIME_TYPES)
    );
    const { size } = await fsp.stat(file);
    const contentType = MIME_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";

    const range = request.headers.get("range");
    if (!range) {
      const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
      return new Response(stream, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(size),
          "Accept-Ranges": "bytes",
        },
      });
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }

    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const clampedEnd = Math.min(end, size - 1);

    const stream = Readable.toWeb(
      fs.createReadStream(file, { start, end: clampedEnd })
    ) as ReadableStream;

    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(clampedEnd - start + 1),
        "Content-Range": `bytes ${start}-${clampedEnd}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
