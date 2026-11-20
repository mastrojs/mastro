import type { Handler, Route } from "../types/mastro.d.ts";
import type { Context } from "../types/middleware.d.ts";

/**
 * Attempts to determine whether we're running a development or production server.
 *
 * Currently this is done by checking whether the hostname is localhost, which is not perfect
 * but allows you to test production behaviour by connecting to `127.0.0.1` and
 * is easy to do without messing with environment variables.
 */
export const isDevServer = (url: URL): boolean => url.hostname === "localhost";

export const routeHandler =
  <E>(rs: Route<Context<E>>[] | Promise<Route<Context<E>>[]>): Handler<Context<E>> =>
  async (req, ctx) => {
    const routes = await rs;
    const method = req.method.toUpperCase();
    const isDev = ctx.mode === "generator" || ctx.environment === "development";

    let urlMatched: string | undefined;
    let params: Record<string, string | undefined> = {};
    const route = routes.find((r) => {
      const match = r.pattern.exec(req.url);
      if (match) {
        urlMatched = r.name;
        if ((r.method === method || r.method === "all") && typeof r.handler === "function") {
          params = match.pathname.groups;
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
      const res = await route.handler(req, { ...ctx, params });
      if (res instanceof Response) {
        return isDev ? Object.assign(res, { routeName: route.name }) : res;
      } else {
        throw Error(`${method} handler in ${route.name} ${noResponseErr}`);
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
const noResponseErr = "must return a Response object. Did you forget \`htmlToResponse\`?";
