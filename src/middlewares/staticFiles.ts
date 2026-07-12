
import { findFiles } from "../core/fs.ts";
import type { Middleware } from "../middleware.ts";
import { serveStaticFile } from "../server/serveStaticFile.ts";

export const staticFiles: Middleware = {
  name: "staticFiles",
  getStaticPaths: async () =>
    (await findFiles(["routes/**/*", "routes/**/.*/**/*"]))
      .filter(isStaticFile).map((p) => p.slice(6)),
  handler: async (req, ctx) => {
    const isDev = true; // TODO
    return await serveStaticFile(req, isDev) || ctx.fetchUpstream(req);
  }
}

const isStaticFile = (p: string) => !p.endsWith(".server.ts") && !p.endsWith(".server.js");
