import { chainMiddlewares, type Middleware, type ServerContext } from "../middleware.ts";
import { fetchUpstream, isDevServer, routeHandler } from "./routeHelpers.ts";

/** Array of HTTP methods */
const httpMethods = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "QUERY"] as const;
export { httpMethods };

/** HTTP methods */
export type HttpMethod = (typeof httpMethods)[number];

/**
 * A fetch handler that takes a standard `Request` and returns a standard `Response`.
 * May take extra arguments that can be typed with e.g. `Handler<[Env, ExecutionContext]>`.
 */
export type Handler<E extends unknown[] = unknown[]> = (
  req: Request,
  ...extra: E
) => Promise<Response> | Response;

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

interface RouteOpts<E extends unknown[]> {
  handler: Handler<E>;
  getStaticPaths?: () => Promise<string[]> | string[];
  pregenerate?: true;
}

/**
 * Class to construct an app instance.
 */
export class Mastro<E extends unknown[] = unknown[]> {
  public middlewares: Middleware<E>[];
  private routes: Route[] = [];
  private routesPromise?: Route[] | Promise<Route[]>;

  constructor(opts?: { middlewares?: Middleware<E>[]; routes?: Route[] | Promise<Route[]> }) {
    this.middlewares = opts?.middlewares || [];
    this.routesPromise = opts?.routes;
  }

  /** Get all routes */
  async getRoutes(): Promise<Route[]> {
    return ((await this.routesPromise) || []).concat(this.routes);
  }

  /** Add route */
  addRoute(method: "all" | HttpMethod, pathname: string, opts: Handler<E> | RouteOpts<E>): this {
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
  get(pathname: string, handler: Handler<E> | RouteOpts<E>): this {
    return this.addRoute("GET", pathname, handler);
  }

  /** Add HTTP POST route */
  post(pathname: string, handler: Handler<E> | RouteOpts<E>): this {
    return this.addRoute("POST", pathname, handler);
  }

  /** Add HTTP PUT route */
  put(pathname: string, handler: Handler<E> | RouteOpts<E>): this {
    return this.addRoute("PUT", pathname, handler);
  }

  /** Add HTTP DELETE route */
  delete(pathname: string, handler: Handler<E> | RouteOpts<E>): this {
    return this.addRoute("DELETE", pathname, handler);
  }

  /** Create fetch handler */
  createHandler(ctx?: Partial<Pick<ServerContext<E>, "environment" | "fetchUpstream">>): Handler<E> {
    const handler = chainMiddlewares([...this.middlewares, routeHandler(this.getRoutes())]);
    return async (req, ...extra) => {
      const isDev = isDevServer(new URL(req.url));
      const environment = isDev ? "development" : "production";
      try {
        return await handler(req, { environment, fetchUpstream, ...ctx, extra, mode: "server" });
      } catch (e: any) {
        const msg = `500 Internal Server Error\n\n${isDev ? e.stack || e : e.name || ""}`;
        return new Response(msg, { status: 500 });
      }
    };
  }
}
