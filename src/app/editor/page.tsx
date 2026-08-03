import fs from "node:fs/promises";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { assertEditorEnabled, findEditDocuments, resolveAllowedPath } from "@/lib/editor/config";
import type { EditDocument } from "../../../scripts/caption/edl";
import { EditorClient } from "./editor-client";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-6 py-16">{children}</main>
    </AppShell>
  );
}

async function Picker() {
  const documents = await findEditDocuments();

  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Transcript editor</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick an edit document produced by{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">scripts/caption/cli.ts</code>.
      </p>

      {documents.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No <code>.edl.json</code> files found. Run the CLI on a video first — it writes the edit
          document next to the source file. If your videos live outside your home directory, set{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">CAPTION_EDITOR_ROOTS</code>.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {documents.map((doc) => (
            <li key={doc.path}>
              <Link
                href={`/editor?file=${encodeURIComponent(doc.path)}`}
                className="block rounded-lg border p-4 transition-colors hover:bg-muted"
              >
                <span className="block font-medium">{doc.path.split("/").pop()}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{doc.path}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  edited {new Date(doc.modifiedAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ file?: string }>;
}) {
  assertEditorEnabled();
  const { file } = await searchParams;
  if (!file) return <Picker />;

  let edlPath: string;
  let edl: EditDocument;
  try {
    edlPath = await resolveAllowedPath(file, [".edl.json"]);
    edl = JSON.parse(await fs.readFile(edlPath, "utf8")) as EditDocument;
  } catch (error) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Could not open that file</h1>
        <p className="mt-2 text-sm text-destructive">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <Link href="/editor" className="mt-6 inline-block text-sm underline">
          Back to the list
        </Link>
      </Shell>
    );
  }

  return (
    <AppShell>
      <EditorClient edlPath={edlPath} initialEdl={edl} />
    </AppShell>
  );
}
