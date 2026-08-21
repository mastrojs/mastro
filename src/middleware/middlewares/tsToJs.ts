import type { Middleware } from "../middleware.ts";
import { tryServeFile } from "./staticFiles/staticFiles.ts";

/**
 * Convert a TypeScript string to JavaScript by running it through `stripTypeScriptTypes`
 * (or `ts-blank-space` on Bun), and then changing imports ending with `.ts` to end in `.js`.
 *
 * Since browsers don't understand TypeScript, we run this function on `.client.ts` files,
 * to convert them to `.client.js` files. Extension needs to change because
 * static file servers don't serve `.ts` files with `content-type: text/javascript`.
 */
export const tsToJs: Middleware = {
  amendStaticPaths: (ps) => ps.map((p) => p.endsWith(".client.ts") ? `${p.slice(0, -3)}.js` : p),
  handler: async (req, ctx) => {
    const { pathname } = new URL(req.url);
    if (pathname.endsWith(".client.js")) {
      const res = await tryServeFile(req, "routes" + pathname.slice(0, -3) + ".ts");
      if (res) {
        if (!res.ok) return res; // 304 Not Modified, etc. get passed through
        const { headers } = res;
        headers.set("Content-Type", "text/javascript; charset=utf-8");
        headers.set("Accept-Ranges", "none");

        // @ts-expect-error no type definitions for Bun
        const { stripTypeScriptTypes } = typeof Bun === "object"
          ? await import(["npm", "ts-blank-space"].join(":"))
              .then((m) => ({ stripTypeScriptTypes: m.default }))
          : await import("node:module");
        const body = stripTypeScriptTypes(await res.text()).replace(importRegex, replacer);
        return new Response(body, { headers })
      }
    }
    return ctx.fetchUpstream(req);
  }
}

const importRegex = /^import .*\.ts("|')(;)?$/gm;
const replacer = (match: string, quote: string, semicolon: string) =>
  match.slice(0, semicolon ? -5 : -4) + `.js${quote};`
