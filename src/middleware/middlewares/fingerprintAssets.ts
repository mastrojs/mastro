import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { extname } from "node:path";
import type { Middleware } from "../middleware.ts";
import { findFiles } from "../../core/fs.ts";

/**
 * TODO:
 * but this doesn't work with routes/_assets/whatever.server.ts because we're doing fs.readFile!!!
 * seems Content-Disposition header to return file-name is inevitable? how else can we feed the
 * path name to the handler function if the path name depends on the output of that function?
 * do we even need amendStaticPaths then or can we just go back to getStaticPaths?
 */
export const fingerprintAssets: Middleware = {
  amendStaticPaths: async previousPaths => {
    const assetHashes: Record<string, string> = {};
    const paths = await Promise.all(previousPaths.map(async path => {
      if (path.startsWith("/_assets/")) {
        const ext = extname(path);
        const digest = hash.update(await fs.readFile(path)).digest("hex").slice(0, 8);
        const hashedPath = `${path.slice(6, -1 * ext.length)}-${digest}${ext}`;
        assetHashes[path.slice(14)] = hashedPath;
        return hashedPath;
      } else {
        return path;
      }
    }));
    if (Object.keys(assetHashes).length > 0) {
      await fs.writeFile("generatedAssets.json", JSON.stringify(assetHashes, null, 2) + "\n");
    }
    return paths;
  },
  handler: async (req, ctx) => {
    const { pathname } = new URL(req.url);
    const newReq = ctx.mode === "generator" && pathname.startsWith("/_assets/")
      ? new Request(req.url.replace(/-[0-9a-f]{8}(\.[a-zA-Z0-9]+)$/, "$1"))
      : req;
    const res = await ctx.fetchUpstream(newReq);
    return res;
  },
}

const hash = createHash("sha256");
