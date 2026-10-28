import { chainMiddlewares, type Context, type Middleware } from "../middleware.ts";
import { fetchUpstream, isDevServer, routeHandler } from "./routeHelpers.ts";

/** HTTP methods */
export const httpMethods = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "QUERY"] as const;

/** HTTP methods */
export type HttpMethod = (typeof httpMethods)[number];

/**
 * A fetch handler that takes a standard `Request` and returns a standard `Response`.
 * On some runtimes, there are two more arguments that Mastro passes through.
 */
export type Handler = (req: Request) => Promise<Response> | Response;

/**
 * A Mastro Route
 */
export interface Route {
  /**
   * Name of the route for error messages etc.
   * For file-based routes the `filePath`, e.g. `/routes/index.server.ts`
   */
  name: string;
  /** Fetch handler */
  handler: Handler;
  /** HTTP method, or "all" if the route should match any HTTP method. */
  method: "all" | HttpMethod;
  /** `URLPattern` with `pathname` set */
  pattern: URLPattern;
  /** Called by the static site generator. */
  getStaticPaths: () => Promise<string[]> | string[];
  /** Before starting your server, you can run `mastro generate --only-pregenerate` to
   * only pregenerate routes which have this field set. */
  pregenerate?: true;
}

/**
 * Either a plain `Handler` function, or an object with a `handler` and other fields.
 */
export type RouteOpts = Handler | {
  handler: Handler;
  getStaticPaths?: () => Promise<string[]> | string[];
  pregenerate?: true;
};

/**
 * Class to construct an app instance.
 */
export class Mastro {
  private middlewares: Middleware[];
  private routes: Route[] = [];

  constructor(...middlewares: Middleware[]) {
    this.middlewares = middlewares;
  }

  /** Add route */
  addRoute(method: "all" | HttpMethod, pathname: string, opts: RouteOpts): this {
    if (typeof opts === "function") {
      opts = { handler: opts };
    }
    this.routes.push({
      getStaticPaths: opts.getStaticPaths || (() => [pathname]),
      handler: opts.handler as Handler,
      method,
      name: pathname,
      pattern: new URLPattern({ pathname }),
      pregenerate: opts.pregenerate,
    });
    return this;
  }

  /** Add HTTP GET route */
  get(pathname: string, handler: RouteOpts): this {
    return this.addRoute("GET", pathname, handler);
  }

  /** Add HTTP POST route */
  post(pathname: string, handler: RouteOpts): this {
    return this.addRoute("POST", pathname, handler);
  }

  /** Add HTTP PUT route */
  put(pathname: string, handler: RouteOpts): this {
    return this.addRoute("PUT", pathname, handler);
  }

  /** Add HTTP DELETE route */
  delete(pathname: string, handler: RouteOpts): this {
    return this.addRoute("DELETE", pathname, handler);
  }

  /** Add new middlewares before existing ones */
  addMiddlewares(...middlewares: Middleware[]): this {
    this.middlewares = middlewares.concat(this.middlewares);
    return this;
  }

  /** Returns the middlewares. If there were routes added, it concats the programmaticRouter. */
  getMiddlewares(ctx?: Context): Middleware[] {
    const m = this.routes.length === 0
      ? []
      : {
        name: "programmaticRouter",
        handler: routeHandler(this.routes),
        getStaticPaths: async () => {
          const routes = ctx?.mode === "generator" && ctx.onlyPregenerate
            ? this.routes.filter(r => r.pregenerate)
            : this.routes;
          return (await Promise.all(routes.map(r => r.getStaticPaths()))).flat();
        },
      };
    return this.middlewares.concat(m);
  }

  /** Create fetch handler */
  createHandler(): Handler {
    const handler = chainMiddlewares(this.getMiddlewares());
    return async (req) => {
      const isDev = isDevServer(new URL(req.url));
      const environment = isDev ? "development" : "production";
      try {
        return await handler(req, { mode: "server", environment, fetchUpstream });
      } catch (e: any) {
        const msg = `500 Internal Server Error\n\n${isDev ? (e.stack || e) : e.name || ""}`;
        return new Response(msg, { status: 500 });
      }
    };
  }
}
