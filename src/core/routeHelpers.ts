import type { Context } from "../middleware.ts";
import type { Handler, Route } from "./mastro.ts";

/**
 * Attempts to determine whether we're running a development or production server.
 *
 * Currently this is done by checking whether the hostname is localhost, which is not perfect
 * but allows you to test production behaviour by connecting to `127.0.0.1` and
 * is easy to do without messing with environment variables.
 */
export const isDevServer = (url: URL): boolean => url.hostname === "localhost";

export const staticCacheControlVal = (req: Request): string | undefined =>
  isDevServer(new URL(req.url)) ? "max-age=0" : undefined;

export const fetchUpstream = (): Response => new Response("Not found", { status: 404 });

export const routeHandler = <E extends unknown[]>(rs: Route<E>[] | Promise<Route<E>[]>): Handler<[Context<E>]> => async (req, ctx) => {
  const routes = await rs;
  const method = req.method.toUpperCase();
  const isDev = ctx.mode === "generator" || ctx.environment === "development";

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
    if (route.pregenerate && !isDev && ctx.mode === "server") {
      return new Response(
        "404 Route was hit on non-localhost but has `pregenerate` set. " +
          "Did you forget to run `mastro/generator --only-pregenerate` as a build step?",
        { status: 404 },
      );
    }
    const res = await route.handler(req, ...ctx.extra);
    if (res instanceof Response) {
      return isDev ? Object.assign(res, { routeName: route.name }) : res;
    } else {
      throw Error(`${method} handler in ${route.name} must return a Response object. Did you forget \`htmlToResponse\`?`);
    }
  } else if (urlMatched) {
    const msg = `405 Method Not Allowed\n\nNo ${method} handler found`;
    const m = isDev ? ` by ${urlMatched}\n\nsee https://mastrojs.github.io/docs/routing/` : "";
    return new Response(msg + m, { status: 405 });
  } else {
    const res = new Response("404 Not Found", { status: 404 });
    return isDev ? Object.assign(res, { error: "No route match" }) : res;
  }
};
