import type { Middleware } from "../middleware.ts";

export const tsToJs: Middleware = async (req, ctx) => {
  if (req.url.endsWith(".client.ts")) {
    const res = await ctx.fetchUpstream(req);
    const fileName = req.url.slice(0, -3) + ".js";
    const { status, headers } = res;
    // status should be 200 or 304 Not Modified, hopefully no range request
    headers.set("Content-Disposition", `filename="${fileName}"`);
    headers.set("Content-Type", "text/javascript; charset=utf-8");
    headers.set("Accept-Ranges", "none");
    return new Response(await convert(await res.text()), { status, headers })
  }
  return ctx.fetchUpstream(req);
}

/**
 * Convert a TypeScript string to JavaScript by running it through `stripTypeScriptTypes`
 * (or `ts-blank-space` on Bun), and then changing imports ending with `.ts` to end in `.js`.
 *
 * Since browsers don't understand TypeScript, we run this function on `.client.ts` files,
 * to convert them to `.client.js` files. Extension needs to change because most
 * static file servers don't serve `.ts` files with `content-type: text/javascript`.
 */
const convert = async (code: string): Promise<string> => {
  // @ts-expect-error no type definitions for Bun
  const { stripTypeScriptTypes } = typeof Bun === "object"
    ? await import(["npm", "ts-blank-space"].join(":"))
        .then((m) => ({ stripTypeScriptTypes: m.default }))
    : await import("node:module");
  const js: string = stripTypeScriptTypes(code);
  return js.replace(
    importRegex,
    (match, quote, semicolon) => match.slice(0, semicolon ? -5 : -4) + `.js${quote};`,
  );
};

const importRegex = /^import .*\.ts("|')(;)?$/gm;
