import { findFiles } from "../core/fs.ts";
import type { Middleware } from "../middleware.ts";
import { tryServeFile } from "./staticFiles/staticFiles.ts";

/**
 * Middleware that converts `*.client.ts` files to `*.client.js` by running it through
 * `stripTypeScriptTypes` (or `ts-blank-space` on Bun), and then
 * changing imports ending with `.ts` to end in `.js`.
 *
 * Since browsers don't understand TypeScript, we run this function on `.client.ts` files,
 * to convert them to `.client.js` files. Extension needs to change because
 * static file servers don't serve `.ts` files with `content-type: text/javascript`.
 */
export const tsToJs: Middleware = {
  name: "tsToJs",
  getStaticPaths: () =>
    findFiles("routes/**/*.client.ts")
      .then((ps) => ps.map((p) => p.slice(6, -3) + ".js")),
  handler: async (req, ctx) => {
    if (ctx.mode === "generator" || ctx.environment === "development") {
      const { pathname } = new URL(req.url);
      if (pathname.endsWith(".client.js")) {
        const res = await tryServeFile(req, "routes" + pathname.slice(0, -3) + ".ts");
        if (res) {
          if (!res.ok) return res; // 304 Not Modified, etc. get passed through
          const { headers } = res;
          headers.set("Content-Type", "text/javascript; charset=utf-8");
          headers.set("Accept-Ranges", "none");
          headers.delete("Content-Length");
          const body = stripTypeScriptTypes(await res.text()).replace(importRegex, "$1.js$2;");
          return new Response(body, { headers });
        }
      }
    }
    return ctx.fetchUpstream(req);
  },
};

// @ts-expect-error no type definitions for Bun
const { stripTypeScriptTypes } = typeof Bun === "object"
  ? await import("npm:ts-blank-space" as any).then((m) => ({ stripTypeScriptTypes: m.default }))
  : await import("node:module");
export const importRegex: RegExp = /^(\s*import\s+[^"'(]*["'][^"']*)\.ts(["']);?$/gm;
