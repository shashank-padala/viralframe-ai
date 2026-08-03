import fs from "node:fs/promises";
import type { NextRequest } from "next/server";
import { errorResponse, resolveAllowedPath } from "@/lib/editor/config";
import type { EditDocument } from "../../../../../scripts/caption/edl";

export async function GET(request: NextRequest) {
  try {
    const file = await resolveAllowedPath(request.nextUrl.searchParams.get("file"), [".edl.json"]);
    const edl = JSON.parse(await fs.readFile(file, "utf8")) as EditDocument;
    return Response.json({ file, edl });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const file = await resolveAllowedPath(request.nextUrl.searchParams.get("file"), [".edl.json"]);
    const body = (await request.json()) as { edl?: EditDocument };
    if (!body.edl || !Array.isArray(body.edl.cards)) {
      return Response.json({ error: "Body must be { edl: EditDocument }" }, { status: 400 });
    }

    // Write to a sibling temp file and rename, so an interrupted save cannot
    // leave a half-written document where the render pipeline expects one.
    const temp = `${file}.tmp`;
    await fs.writeFile(temp, JSON.stringify(body.edl, null, 2));
    await fs.rename(temp, file);

    return Response.json({ ok: true, cards: body.edl.cards.length });
  } catch (error) {
    return errorResponse(error);
  }
}
