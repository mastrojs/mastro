import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { extname } from "node:path";
import type { Middleware } from "../middleware.ts";

export const fingerprintAssets: Middleware = {
  name: "fingerprintAssets",
  handler: async (req, ctx) => {
    const res = await ctx.fetchUpstream(req);
    const { pathname } = new URL(req.url);
    if (ctx.mode === "generator" && pathname.startsWith("/_assets/")) {
      const ext = extname(pathname);
      const data = await res.arrayBuffer().then(Buffer.from);
      const digest = hash.update(data).digest("hex").slice(0, 8);
      const hashedPath = `${pathname.slice(0, -1 * ext.length)}-${digest}${ext}`;
      assetHashes[pathname.slice("/_assets/".length)] = hashedPath;

      const headers = res.headers;
      headers.set("Content-Disposition", `attachment; filename=${hashedPath}`);
      return new Response(data, { headers, status: res.status });
    } else {
      return res;
    }
  },
  afterGenerate: async (ctx) => {
    if (ctx.onlyPregenerate && Object.keys(assetHashes).length > 0) {
      await fs.writeFile("generatedAssets.json", JSON.stringify(assetHashes, null, 2) + "\n");
    }
  },
};

// during SSG all _assets/* routes should've been processed already before routes calling getAsset
export const getAsset = (path: string) => Object.freeze(assetHashes)[path];

const hash = createHash("sha256");
const assetHashes: Record<string, string> = {};
