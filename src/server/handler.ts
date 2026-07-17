import { type Handler, isDevServer, type Route } from "../routers/common.ts";

/**
 * Options for `createHandler`
 */
export interface CreateHandlerOpts {
  routes: Route[] | Promise<Route[]>;
}

export const createMastroHandler = (opts: CreateHandlerOpts): Handler =>
async (req: Request) => {
  const routes = await opts.routes;
  const method = req.method.toUpperCase();
  const url = new URL(req.url);
  const logPrefix = `${req.method} ${url.pathname + url.search} => `;
  const isDev = isDevServer(url);


  try {
    let urlMatched: string | undefined;
    const route = routes.find((r) => {
      const match = r.pattern.exec(req.url);
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
      const res = await handler(req);
      if (res instanceof Response) {
        if (isDev) console.info(logPrefix + route.name);
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
      // TODO: ctx.fetchUpstream here
      return new Response("404 not found", { status: 404 });
    }
  } catch (e: any) {
    if (e.name === "NotFound" || e.code === "ENOENT") {
      console.warn(`\x1b[35m${logPrefix}404\x1b[0m`, e);
      return new Response(`404 Not Found\n\n${isDev ? e.message : ""}`, { status: 404 });
    } else {
      throw e;
    }
  }
};
