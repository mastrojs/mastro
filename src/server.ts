/**
 * This module exports a `fetch` handler that can be passed to
 * [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with [deno serve](https://docs.deno.com/runtime/reference/cli/serve/)
 * command line interface.
 * @module
 */

import { pathToFileURL } from "node:url";
import { matchRoute } from "./core/router.ts";

/**
 * Fetch handler to serve Mastro routes and static files
 */
const fetch = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const isNotFavicon = url.pathname !== "/favicon.ico";
  const isDev = isDevServer(url);
  const isCloudflare = navigator.userAgent === "Cloudflare-Workers";

  try {
    if (!isCloudflare) {
      const { serveStaticFile } = await import("./staticFiles.ts");
      const fileRes = await serveStaticFile(req, isDev);
      if (fileRes) {
        return fileRes;
      }
    }

    const method = req.method.toUpperCase();
    const route = matchRoute(req.url);
    if (route) {
      const { filePath } = route;
      if (isDev) {
        console.info(`${method} ${url.pathname + url.search} => ${filePath}`);
      }
      const module = isCloudflare
        ? await relativeImport(filePath)
        : await import(pathToFileURL(process.cwd() + filePath).toString());
      const handler = module[method];
      if (!handler) {
        return new Response(`No function ${method} exported by ${filePath}`, {
          status: 405,
        });
      }
      if (module.pregenerate && !isDev) {
        return new Response(
          "404 Route was hit on non-localhost but exports pregenerate=true. " +
          "Did you forget to run generate as a build step?",
          { status: 404 },
        );
      }
      const res = await handler(req);
      if (res instanceof Response) {
        return res;
      } else {
        throw Error(method + " must return a Response object");
      }
    } else {
      if (isDev && isNotFavicon) {
        console.info(`${method} ${url.pathname + url.search} => No route match`);
      }
      return new Response("404 not found", { status: 404 });
    }
  } catch (e: any) {
    if (isNotFavicon) {
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
const defaultExport: { fetch: (req: Request) => Promise<Response>; } = { fetch };
export default defaultExport;

/**
 * Attempts to give a reasonable `Cache-Control` header value for static files by looking
 * at the `DENO_DEPLOYMENT_ID` env variable and whether the host is local or not.
 */
export const staticCacheControlVal = (req: Request): string | undefined => {
    if (typeof Deno ==="object" && Deno.env.get("DENO_DEPLOYMENT_ID")) {
      // See https://docs.deno.com/deploy/early-access/reference/caching/
      // The idea is to have the CDN of Deno Deploy EA cache static assets forever (7d)
      // which is okay because deploys invalidate the cache.
      // Browsers meanwhile would use etags to see whether the file has been updated.
      return "s-maxage=604800";
    } else if (isDevServer(new URL(req.url))) {
       return "max-age=0";
    }
}

/**
 * Attempts to determine whether we're running a development or production server.
 *
 * Currently this is done by checking whether the hostname is localhost, which is not perfect
 * but allows you to test production behaviour by connecting to `127.0.0.1` and
 * is easy to do without messing with environment variables.
 */
const isDevServer = (url: URL) =>
  url.hostname === "localhost"

/**
 * Wrangler uses esbuild, which can include dynamically imported files in the bundle
 * if done right: see https://esbuild.github.io/api/#glob
 * We assume current file is either at node_modules/@mastrojs/mastro/src/server.js or at
 * node_modules/.pnpm/@jsr+mastrojs__mastro@0.4.6/node_modules/@jsr/mastrojs__mastro/src/server.js
 */
const relativeImport = (path: string) => {
  const prefix = path.slice(7, -10);
  const suffix = path.endsWith(".ts") ? "ts" : "js";
  try {
    return import(`../../../../routes/${prefix}.server.${suffix}`);
  } catch {
    return import(`../../../../../../../routes/${prefix}.server.${suffix}`);
  }
};
