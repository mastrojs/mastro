/**
 * This module exports a `fetch` handler that can be passed to
 * [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with [deno serve](https://docs.deno.com/runtime/reference/cli/serve/)
 * command line interface.
 * @module
 */

import { serveFile } from "@std/http/file-server";
import { toFileUrl } from "@std/path";
import { matchRoute } from "./router.ts";

const importRegex = /^import .*\.ts("|')(;)?$/gm;

/**
 * Convert a TypeScript string to JavaScript by running it through `tsBlankSpace`
 * and changing imports ending with `.ts` to end with `.js`.
 *
 * Since browsers don't understand TypeScript and static file servers generally
 * don't serve `.ts` files with `content-type: text/javascript`, we need to run this
 * function on `.client.ts` files, to convert them to `.client.js` files.
 */
export const tsToJs = (text: string): Promise<string> =>
  import("ts-blank-space").then((tsBlankSpace) =>
    tsBlankSpace.default(text)
      .replace(
        importRegex,
        (match, quote, semicolon) => match.slice(0, semicolon ? -5 : -4) + `.js${quote};`,
      )
  );

const fetch = async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);

  try {
    const staticPath = pathname.endsWith("/") ? (pathname + "index.html") : pathname;
    const fileRes = await getStaticFile(req, staticPath);
    if (fileRes) {
      return fileRes;
    }
    if (pathname.endsWith(".client.js")) {
      const fileRes = await getStaticFile(req, pathname.slice(0, -3) + ".ts");
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
    const route = matchRoute(req.url);
    if (route) {
      const modulePath = Deno.cwd() + route.filePath;
      const method = req.method.toUpperCase();
      console.info(`${method} ${req.url}, loading ${modulePath}`);
      const module = await import(toFileUrl(modulePath).toString());
      const handler = module[method];
      if (!handler) {
        return new Response(`No function ${method} exported by ${modulePath}`, {
          status: 405,
        });
      }
      const res = await handler(req);
      if (res instanceof Response) {
        return res;
      } else {
        throw Error(method + " must return a Response object");
      }
    } else {
      return new Response("404 not found", { status: 404 });
    }
  } catch (e: any) {
    if (pathname !== "/favicon.ico") {
      console.warn(e);
    }
    if (e.name === "NotFound" || e.code === "ENOENT") {
      return new Response("404 not found", { status: 404 });
    } else {
      return new Response(`500: ${e.name || "Unknown error"}\n\n${e}`, { status: 500 });
    }
  }
};

/**
 * Default export with a `fetch` handler.
 * See [fetch handlers](https://blog.val.town/blog/the-api-we-forgot-to-name/)
 * and [Deno.ServeDefaultExport](https://docs.deno.com/api/deno/~/Deno.ServeDefaultExport).
 */
export default { fetch };

const getStaticFile = async (req: Request, path: string) => {
  const res = await serveFile(req, "routes" + path);
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

export const staticCacheControlVal = (req: Request): string | undefined => {
    const { hostname } = new URL(req.url);
    if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
      // See https://docs.deno.com/deploy/early-access/reference/caching/
      // The idea is to have the CDN of Deno Deploy EA cache static assets forever (7d)
      // which is okay because deploys invalidate the cache.
      // Browsers meanwhile would use etags to see whether the file has been updated.
      return "s-maxage=604800";
    } else if (hostname === "localhost" || hostname === "127.0.0.1") {
       return "max-age=0";
    }
}
