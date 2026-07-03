/**
 * This module exports the `Mastro` class to create a server using the
 * [programmatic router](https://mastrojs.github.io/docs/routing/#programmatic-router).
 * @module
 */

import type { GenerateOpts } from "../generator.ts";
import { chainMiddlewares, type Middleware } from "../middleware.ts";
import { createMastroHandler } from "../server/handler.ts";
import { type Handler, type HttpMethod, importSuffix, type Route } from "./common.ts";

export { staticCacheControlVal } from "./common.ts";
export type { GenerateOpts, Handler, HttpMethod };

/**
 * Either a plain `Handler` function, or an object with a `handler` and other fields.
 */
export type RouteOpts = Handler | {
  handler: Handler;
  getStaticPaths?: () => Promise<string[]> | string[];
  pregenerate?: true;
};

/**
 * Class to use as programmatic router (alternative to the file-based router).
 */
export class Mastro {
  private routes: Route[] = [];
  private middleware: Middleware | undefined = undefined;

  /** Add route */
  addRoute(method: "all" | HttpMethod, pathname: string, opts: RouteOpts): this {
    if (typeof opts === "function") {
      opts = { handler: opts };
    }
    const { getStaticPaths, pregenerate } = opts;
    this.routes.push({
      getStaticPaths,
      handler: opts.handler as Handler,
      method,
      name: pathname,
      pattern: new URLPattern({ pathname }),
      pregenerate,
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

  /** Generate static site */
  async generate(opts?: Omit<GenerateOpts, "routes" | "writeRoutenames">): Promise<void> {
    const modPath = `../generator.${importSuffix}`; // variable to prevent esbuild bundling
    const { generate } = await import(modPath);
    return generate({ ...opts, routes: this.routes, middleware: this.middleware });
  }

  middlewares(...middlewares: Middleware[]): this {
    this.middleware = chainMiddlewares(middlewares);
    return this;
  }

  /** Create fetch handler */
  createHandler(opts: {
    /** defaults to true */
    serveStaticFiles?: boolean;
  } = {}): Handler {
    const fetchUpstream = createMastroHandler({ ...opts, routes: this.routes });
    const { middleware } = this;
    return middleware
      ? req => middleware(req, { mode: "server", fetchUpstream })
      : fetchUpstream;
  }
}
