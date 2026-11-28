import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { posix } from "node:path";

import { readTextFile } from "../core/fs.ts";
import type { Middleware } from "../types/middleware.d.ts";

const g = globalThis as typeof globalThis & { _mastroAssets: Record<string, string | undefined> };
g._mastroAssets = await readTextFile("generatedAssets.json").then(JSON.parse).catch(() => ({}));

export const fingerprintAssets: Middleware = {
  name: "fingerprintAssets",
  handler: async (req, ctx) => {
    const res = await ctx.fetchNext(req);
    if (!res.ok) return res;
    const { pathname } = new URL(req.url);
    if (pathname.startsWith("/_assets/")) {
      if (ctx.mode === "generator") {
        const ext = posix.extname(pathname);
        const data = await res.arrayBuffer().then(Buffer.from);
        const digest = createHash("sha256").update(data).digest("hex").slice(0, 8);
        const path = `${pathname.slice(0, pathname.length - ext.length)}-${digest}${ext}`;
        g._mastroAssets[pathname.slice("/_assets/".length)] = path;
        res.headers.set("Content-Disposition", `attachment; filename=${posix.basename(path)}`);
        return new Response(data, res);
      } else if (ctx.environment === "production") {
        res.headers.set("Cache-Control", "public, max-age=31556952, immutable");
      }
    }
    return res;
  },
  beforeGenerate: async () => {
    g._mastroAssets = {};
  },
  afterGenerate: async (ctx) => {
    if (ctx.onlyPregenerate && Object.keys(g._mastroAssets).length > 0) {
      await fs.writeFile("generatedAssets.json", JSON.stringify(g._mastroAssets, null, 2) + "\n");
    }
  },
};
