import { type Handler, importSuffix, isDevServer, type Route } from "./routers/common.ts";

/**
 * Options for `createHandler`
 */
export interface CreateHandlerOpts {
  routes?: Route[];
  /** defaults to true */
  serveStaticFiles?: boolean;
}

/**
 * Create fetch handler that serves Mastro routes and static files
 */
export const createHandler = <E, C>(opts?: CreateHandlerOpts): Handler<E, C> =>
async (
  req: Request,
  env: E,
  ctx: C,
) => {
  // in variable to prevent bundling by esbuild:
  const fileRouterPath = `./routers/fileRouter.${importSuffix}`;
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
      // imports in variable to prevent bundling by esbuild
      let mod;
      try {
        const modPath = `./staticFiles.${importSuffix}`;
        mod = await import(modPath);
      } catch {
        // when there's a package.json preset (as in the cloudflare template), Deno also needs .js
        const modPath = `./staticFiles.js`;
        mod = await import(modPath);
      }
      const fileRes = await mod.serveStaticFile(req, isDev);
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
        const msg = `No ${method} handler found`;
        if (isDev) console.info(logPrefix + msg);
        const m = isDev ? ` by ${route.name}\n\nsee https://mastrojs.github.io/docs/routing/` : "";
        return new Response(msg + m, { status: 405 });
      }
      if (pregenerate && !isDev) {
        return new Response(
          "404 Route was hit on non-localhost but exports pregenerate=true. " +
            "Did you forget to run `mastro/generator --only-pregenerate` as a build step?",
          { status: 404 },
        );
      }
      const res = await handler(req, env as any, ctx as any);
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
