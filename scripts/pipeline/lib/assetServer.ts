import http from "node:http";
import serveHandler from "serve-handler";

export interface AssetServer {
  port: number;
  close: () => Promise<void>;
}

/**
 * Serves a directory over loopback HTTP for the duration of a render.
 *
 * Remotion's headless Chrome cannot read local file paths, and copying
 * assets into the bundle's public/ dir after bundle() runs does not work in
 * practice. A local HTTP server is Remotion's own documented answer for
 * per-render assets downloaded at runtime, and it is what makes seeking
 * across a long source video fast -- doing the same seeks against a remote
 * signed URL turned a 48s render into ~17 minutes.
 */
export async function serveLocalDir(dir: string): Promise<AssetServer> {
  const server = http.createServer((req, res) => serveHandler(req, res, { public: dir }));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine local asset server port");
  }
  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
