/**
 * This module exports various ways to create a Mastro server.
 * @module
 */

import type { Handler, Route } from "./routers/common.ts";
export type { Handler, HttpMethod, Route } from "./routers/common.ts";

export * from "./routers/fileRouter.ts";
export * from "./routers/programmaticRouter.ts";

/**
 * Options for `createHandler`
 */
export interface CreateHandlerOpts {
  routes?: Route[];
  serveStaticFiles?: false;
}

/**
 * Create fetch handler that serves Mastro routes and static files
 */
export const createHandler = (opts?: CreateHandlerOpts): Handler => async (req: Request) => {
  // in variable to prevent bundling by esbuild:
  const fileRouterPath = `./routers/fileRouter.${suffix}`;
  const {
    routes = await import(fileRouterPath).then((mod) => mod.loadRoutes()) as Route[],
    serveStaticFiles = true,
  } = opts || {};
  const url = new URL(req.url);
  const logPrefix = `${req.method} ${url.pathname + url.search} => `;
  const isDev = isDevServer(url);

  try {
    const method = req.method.toUpperCase();
    if (method === "GET" && serveStaticFiles) {
      const modPath = `./staticFiles.${suffix}`; // in variable to prevent bundling by esbuild
      const { serveStaticFile } = await import(modPath);
      const fileRes = await serveStaticFile(req, isDev);
      if (fileRes) {
        return fileRes;
      }
    }

    const route = routes.find((r) => {
      const match = r.pattern.exec(req.url);
      if (match) {
        (req as any)._params = match.pathname.groups;
      }
      return match;
    });

    if (route) {
      const { handler, pregenerate } = route;
      if (method !== route.method || typeof handler !== "function") {
        const msg = `No ${method} handler function exported`;
        if (isDev) console.info(logPrefix + msg);
        return new Response(`${msg} by ${route.name}`, { status: 405});
      }
      if (pregenerate && !isDev) {
        return new Response(
          "404 Route was hit on non-localhost but exports pregenerate=true. " +
            "Did you forget to run `mastro/generator --only-pregenerate` as a build step?",
          { status: 404 },
        );
      }
      const res = await handler(req);
      if (res instanceof Response) {
        if (isDev) console.info(logPrefix + route.name);
        return res;
      } else {
        throw Error(method + " must return a Response object");
      }
    } else {
      if (isDev && url.pathname !== "/favicon.ico") console.info(logPrefix + "No route match");
      return new Response("404 not found", { status: 404 });
    }
  } catch (e: any) {
    console.warn(`\x1b[35m${logPrefix}\x1b[0m`, e);
    if (e.name === "NotFound" || e.code === "ENOENT") {
      return new Response("404 not found", { status: 404 });
    } else {
      return new Response(`500: ${e.name || "Unknown error"}\n\n${e}`, { status: 500 });
    }
  }
};

/**
 * Default export with a `fetch` handler.
 *
 * Can be passed to [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with the [deno serve](https://docs.deno.com/runtime/reference/cli/serve/) CLI.
 */
const defaultExport: { fetch: Handler } = { fetch: createHandler() };
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

// @ts-expect-error no type definitions for Bun
const suffix = typeof Deno === "object" || typeof Bun === "object" ? "ts" : "js";
