import { serveFile as serveFileNode } from "./node/serveFile.ts";
import { staticCacheControlVal } from "./routers/common.ts";

const importRegex = /^import .*\.ts("|')(;)?$/gm;

/**
 * Convert a TypeScript string to JavaScript by running it through `stripTypeScriptTypes` (Node.js)
 * and `ts-blank-space` (Deno and Bun), and then changing imports ending with `.ts` to end in `.js`.
 *
 * Since browsers don't understand TypeScript and static file servers generally
 * don't serve `.ts` files with `content-type: text/javascript`, we need to run this
 * function on `.client.ts` files, to convert them to `.client.js` files.
 */
export const tsToJs = async (code: string): Promise<string> => {
  const tsBlankSpace = ["npm", "ts-blank-space"].join(":");
  // @ts-expect-error no type definitions for Bun
  const { stripTypeScriptTypes } = typeof Deno === "object" || typeof Bun === "object"
    ? await import(tsBlankSpace).then((m) => ({ stripTypeScriptTypes: m.default }))
    : await import("node:module");
  const js: string = stripTypeScriptTypes(code);
  return js.replace(
    importRegex,
    (match, quote, semicolon) => match.slice(0, semicolon ? -5 : -4) + `.js${quote};`,
  );
};

/**
 * Utility function for the server to serve static files as well.
 *
 * 1. look for matching file in `generated` folder
 * 2. look for matching file in `routes` folder.
 *     - if requested url ends in `.client.js`, transpile the corresponding `.ts` file
 */
export const serveStaticFile = async (
  req: Request,
  isDev: boolean,
): Promise<Response | undefined> => {
  const { pathname } = new URL(req.url);

  const staticPath = pathname.endsWith("/") ? (pathname + "index.html") : pathname;
  const pregeneratedFile = isDev
    ? undefined
    : await serveFile(req, "generated" + staticPath);
  const fileRes = pregeneratedFile || await serveFile(req, "routes" + staticPath);
  if (fileRes) {
    return fileRes;
  }
  if (pathname.endsWith(".client.js")) {
    const fileRes = await serveFile(req, "routes" + pathname.slice(0, -3) + ".ts");
    if (fileRes) {
      const { status, headers } = fileRes; // // 200 or 304 Not Modified, hopefully no range request
      headers.set("Content-Type", "text/javascript; charset=utf-8");
      headers.set("Accept-Ranges", "none");
      return new Response(
        await tsToJs(await fileRes.text()) || null,
        { status, headers },
      );
    }
  }
};

const serveFile = async (req: Request, path: string) => {
  const serveFile = typeof Deno === "object"
    ? (await import("@std/http/file-server")).serveFile
    : serveFileNode;
  const res = await serveFile(req, path);
  if (res.status === 404 || res.status === 405) {
    return;
  } else {
    const cacheHeader = staticCacheControlVal(req);
    if (cacheHeader) {
      res.headers.set("Cache-Control", cacheHeader);
    }
    return res;
  }
};
