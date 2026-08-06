import { type Handler, importSuffix, isDevServer, type Route } from "../routers/common.ts";

/**
 * Options for `createHandler`
 */
export interface CreateHandlerOpts {
  routes: Route[] | Promise<Route[]>;
  /** defaults to true */
  serveStaticFiles?: boolean;
}

export const createMastroHandler = <E, C>(opts: CreateHandlerOpts): Handler<E, C> =>
async (
  req: Request,
  env: E,
  ctx: C,
) => {
  const { serveStaticFiles = true } = opts;
  const routes = await opts.routes;
  const method = req.method.toUpperCase();
  const url = new URL(req.url);
  const logPrefix = `${req.method} ${url.pathname + url.search} => `;
  const isDev = isDevServer(url);
  
  // Treat a request for `/foo/index.html` the same as `/foo/` so that a
  // `routes/foo/index.server.ts` route (and the generated `foo/index.html`
  // file) is served. This makes the dev server behave like a static host, where
  // both URLs resolve to the same file.
  let request = req;
  if (url.pathname.endsWith("/index.html")) {
    const normalized = new URL(url);
    normalized.pathname = normalized.pathname.slice(0, -"index.html".length);
    request = new Request(normalized, req);
    url.pathname = normalized.pathname;
  }
  
  const setCacheHeaders = (res: Response) => {
    if (!isDev && url.pathname.startsWith("/_assets/") && method === "GET") {
      res.headers.set("Cache-Control", "public, max-age=31556952, immutable");
    }
  };

  try {
    if (method === "GET" && serveStaticFiles) {
      // imports in variable to prevent bundling by esbuild
      const modPath1 = `./serveStaticFile.${importSuffix}`;
      const modPath2 = `./serveStaticFile.js`;
      // when there's a package.json present (as in the cloudflare template), Deno also needs .js
      const mod = await import(modPath1).catch(() => import(modPath2));
      const fileRes = await mod.serveStaticFile(request, isDev);
      if (fileRes) {
        setCacheHeaders(fileRes);
        return fileRes;
      }
    }

    let urlMatched: string | undefined;
    const route = routes.find((r) => {
      const match = r.pattern.exec(request.url);
      if (match) {
        urlMatched = r.name;
        if ((r.method === method || r.method === "all") && typeof r.handler === "function") {
          (req as any)._params = match.pathname.groups;
          return true;
        }
      }
    });

    if (route) {
      const { handler, pregenerate } = route;
      if (pregenerate && !isDev) {
        return new Response(
          "404 Route was hit on non-localhost but exports pregenerate=true. " +
            "Did you forget to run `mastro/generator --only-pregenerate` as a build step?",
          { status: 404 },
        );
      }
      const res = await handler(request, env as any, ctx as any);
      if (res instanceof Response) {
        if (isDev) console.info(logPrefix + route.name);
        setCacheHeaders(res);
        return res;
      } else {
        throw Error(method + " must return a Response object");
      }
    } else if (urlMatched) {
      const msg = `No ${method} handler found`;
      if (isDev) console.info(logPrefix + msg);
      const m = isDev ? ` by ${urlMatched}\n\nsee https://mastrojs.github.io/docs/routing/` : "";
      return new Response(msg + m, { status: 405 });
    } else {
      if (isDev && url.pathname !== "/favicon.ico") console.info(logPrefix + "No route match");
      return new Response("404 route not found", { status: 404 });
    }
  } catch (e: any) {
    const [msg, status] = e.name === "NotFound" || e.code === "ENOENT"
      ? [`404 Not Found\n\n${isDev ? e.message : ""}`, 404]
      : [`500 Internal Server Error\n\n${isDev ? (e.stack || e) : e.name || "Unknown error"}`, 500];
    console.warn(`\x1b[35m${logPrefix}${status}\x1b[0m`, e);
    return new Response(msg, { status });
  }
};
