import { isDevServer, routeHandler } from "./core/routeHelpers.ts";
import { chainMiddlewares } from "./middleware.ts";
import type { Handler, Pathname, Route, RouteHandler, Simplify } from "./types/mastro.d.ts";
import type { CompatibleLocals, Context, Middleware } from "./types/middleware.d.ts";

/** Array of HTTP methods */
const httpMethods = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "QUERY"] as const;
export { httpMethods };

/** HTTP methods */
export type HttpMethod = (typeof httpMethods)[number];

/**
 * Class to construct an app instance.

 * ```ts
 * const app = new Mastro()
 *   .use(myMiddleware)
 *   .get("/", (req, ctx) => new Response("Hi"))
 * ```
 *
 * For Node.js and Bun, use the `createApp` or `createFileRouterApp`
 * factories that you can import from "@mastrojs/mastro/server".
 *
 * For the types to get passed through correctly, be sure to chain the method calls as shown above.
 * Otherwise, the generics for URL path parameters, and locals set by middleware, won't be inferred
 * correctly. When using TypeScript, do NOT do something like the following:
 *
 * ```js
 * const badApp = new Mastro();
 * badApp.use(authMiddleware);
 * badApp.get("/", handler);
 * ```
 */
export class Mastro<E extends unknown[] = unknown[], L = {}> {
  private middlewares: Middleware<{}, Context<E>>[] = [];
  private routes: Route<Context<E>>[] = [];
  private routesPromise?: Route<Context<E>>[] | Promise<Route<Context<E>>[]>;

  constructor(opts?: { routes?: Route<Context<E>>[] | Promise<Route<Context<E>>[]> }) {
    this.routesPromise = opts?.routes;
  }

  /** Get a read-only snapshot of registered middleware in execution order. */
  getMiddlewares(): Middleware<{}, Context<E>>[] {
    return [...this.middlewares];
  }

  /** Get all routes. */
  async getRoutes(): Promise<Route<Context<E>>[]> {
    return ((await this.routesPromise) || []).concat(this.routes);
  }

  /** Add a {@link Middleware} to the stack. Chain calls to pass locals to subsequent middleware. */
  use<SetL = {}>(
    middleware: Middleware<SetL, Context<E, L>> & CompatibleLocals<L, SetL>,
  ): Mastro<E, Simplify<L & Omit<SetL, keyof L>>> {
    this.middlewares.push(middleware as any);
    return this as any;
  }

  /** Add route */
  addRoute<P extends Pathname>(
    method: "all" | HttpMethod,
    pathname: P,
    opts: RouteHandler<E, L, P>,
  ): this {
    if (typeof opts === "function") {
      opts = { handler: opts };
    }
    this.routes.push({
      getStaticPaths: opts.getStaticPaths,
      handler: opts.handler as Handler<Context<E>>,
      method,
      name: pathname,
      pattern: new URLPattern({ pathname }),
      pregenerate: opts.pregenerate,
    });
    return this;
  }

  /** Add HTTP GET route */
  get<P extends Pathname>(pathname: P, handler: RouteHandler<E, L, P>): this {
    return this.addRoute("GET", pathname, handler);
  }

  /** Add HTTP POST route */
  post<P extends Pathname>(pathname: P, handler: RouteHandler<E, L, P>): this {
    return this.addRoute("POST", pathname, handler);
  }

  /** Add HTTP PUT route */
  put<P extends Pathname>(pathname: P, handler: RouteHandler<E, L, P>): this {
    return this.addRoute("PUT", pathname, handler);
  }

  /** Add HTTP DELETE route */
  delete<P extends Pathname>(pathname: P, handler: RouteHandler<E, L, P>): this {
    return this.addRoute("DELETE", pathname, handler);
  }

  /** Create fetch handler */
  createHandler(ctx?: {
    environment?: "development" | "production";
  }): (req: Request, ...extras: E) => Promise<Response> {
    const handler = chainMiddlewares<E>(this.middlewares, routeHandler(this.getRoutes()));
    return async (req, ...extras) => {
      const url = new URL(req.url);
      const environment = isDevServer(url) ? ("development" as const) : ("production" as const);
      const mode = "server" as const;
      const c = { environment, ...ctx, extras, locals: {}, params: {}, mode };
      const res = await handler(req, c);
      // if the logger middleware is not present, we let the platform (e.g. wrangler) show errors:
      if (c.environment === "development" && res.status >= 500 && "error" in res) throw res.error;
      return res;
    };
  }
}
