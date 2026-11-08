import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { posix } from "node:path";
import type { Middleware } from "../middleware.ts";

export const fingerprintAssets: Middleware = {
  name: "fingerprintAssets",
  handler: async (req, ctx) => {
    const res = await ctx.fetchUpstream(req);
    if (!res.ok) return res;
    const { pathname } = new URL(req.url);
    if (ctx.mode === "generator" && pathname.startsWith("/_assets/")) {
      const ext = posix.extname(pathname);
      const data = await res.arrayBuffer().then(Buffer.from);
      const digest = createHash("sha256").update(data).digest("hex").slice(0, 8);
      const hashedPath = `${pathname.slice(0, pathname.length - ext.length)}-${digest}${ext}`;
      assetHashes[pathname.slice("/_assets/".length)] = hashedPath;
      res.headers.set("Content-Disposition", `attachment; filename=${posix.basename(hashedPath)}`);
      return new Response(data, res);
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

const assetHashes: Record<string, string> = {};
