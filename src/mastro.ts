import { chainMiddlewares, type Middleware } from "./middleware.ts";

/** Supported HTTP methods */
export const httpMethods = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"] as const;

/** Supported HTTP methods */
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
  /** Called by the static site generator on routes with route parameters in the pattern. */
  getStaticPaths?: () => Promise<string[]> | string[];
  /** When running a server, set this to `true` to still build this route statically. */
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
  public middlewares: Middleware[] = [];
  private routes: Route[] = [];

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

  /** Create fetch handler */
  createHandler(): Handler {
    const middlewares = this.routes.length > 0
      ? this.middlewares.concat(routeHandler(this.routes))
      : this.middlewares;
    const handler = chainMiddlewares(middlewares);
    return async (req) => {
      const isDev = isDevServer(new URL(req.url));
      const environment = isDev ? "development" : "production";
      try {
        return await handler(req, { mode: "server", environment, fetchUpstream });
      } catch (e: any) {
        return new Response(
          `500 Internal Server Error\n\n${isDev ? (e.stack || e) : e.name || "Unknown error"}`,
          { status: 500 },
        );
      }
    };
  }

  /** Add new middlewares before existing ones */
  addMiddlewares(...middlewares: Middleware[]): this {
    this.middlewares.unshift(...middlewares);
    return this;
  }
}

const fetchUpstream = () => new Response("Not found", { status: 404 });

/**
 * Attempts to determine whether we're running a development or production server.
 *
 * Currently this is done by checking whether the hostname is localhost, which is not perfect
 * but allows you to test production behaviour by connecting to `127.0.0.1` and
 * is easy to do without messing with environment variables.
 */
const isDevServer = (url: URL) => url.hostname === "localhost";

export const routeHandler = (rs: Route[] | Promise<Route[]>): Handler => async (req: Request) => {
  const routes = await rs;
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
          return true;
        }
      }
    });

    if (route) {
      /* TODO: only do this on server, not generate
      if (route.pregenerate && !isDev) {
        return new Response(
          "404 Route was hit on non-localhost but exports pregenerate=true. " +
            "Did you forget to run `mastro/generator --only-pregenerate` as a build step?",
          { status: 404 },
        );
      }
      */
      const res = await route.handler(req);
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
