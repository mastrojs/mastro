/**
 * This module exports a `fetch` handler that can be passed to
 * [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with [deno serve](https://docs.deno.com/runtime/reference/cli/serve/)
 * command line interface.
 * @module
 */

import { getRoutes } from "./core/router.ts";

/**
 * Fetch handler to serve Mastro routes and static files
 */
const fetch = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const isNotFavicon = url.pathname !== "/favicon.ico";
  const isDev = isDevServer(url);

  try {
    const method = req.method.toUpperCase();
    if (method === "GET" && navigator.userAgent !== "Cloudflare-Workers") {
      const { serveStaticFile } = await import("./staticFiles.ts");
      const fileRes = await serveStaticFile(req, isDev);
      if (fileRes) {
        return fileRes;
      }
    }

    const routes = await getRoutes();
    const route = routes.find((r) => r.pattern.exec(req.url));
    if (route) {
      const module = await route.module;
      if (isDev) {
        console.info(`${method} ${url.pathname + url.search} => ${route.name}`);
      }
      const handler = module[method];
      if (typeof handler !== "function") {
        return new Response(`No function ${method} exported by ${route.name}`, {
          status: 405,
        });
      }
      if (module.pregenerate && !isDev) {
        return new Response(
          "404 Route was hit on non-localhost but exports pregenerate=true. " +
            "Did you forget to run `mastro/generator --only-pregenerate` as a build step?",
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
const defaultExport: { fetch: (req: Request) => Promise<Response> } = { fetch };
export default defaultExport;

/**
 * Attempts to give a reasonable `Cache-Control` header value for static files by looking
 * at the `DENO_DEPLOYMENT_ID` env variable and whether the host is local or not.
 */
export const staticCacheControlVal = (req: Request): string | undefined => {
  if (typeof Deno === "object" && Deno.env.get("DENO_DEPLOYMENT_ID")) {
    // See https://docs.deno.com/deploy/early-access/reference/caching/
    // The idea is to have the CDN of Deno Deploy EA cache static assets forever (7d)
    // which is okay because deploys invalidate the cache.
    // Browsers meanwhile would use etags to see whether the file has been updated.
    return "s-maxage=604800";
  } else if (isDevServer(new URL(req.url))) {
    return "max-age=0";
  }
};

/**
 * Attempts to determine whether we're running a development or production server.
 *
 * Currently this is done by checking whether the hostname is localhost, which is not perfect
 * but allows you to test production behaviour by connecting to `127.0.0.1` and
 * is easy to do without messing with environment variables.
 */
const isDevServer = (url: URL) => url.hostname === "localhost";
