import type { GenerateOpts } from "../generator.ts";
import { createHandler, type CreateHandlerOpts } from "../server.ts";
import { type Handler, type HttpMethod, importSuffix, type Route } from "./common.ts";

/**
 * Either a plain `Handler` function, or an object with a `handler` and other fields.
 */
export type RouteOpts<E, C> = Handler<E, C> | {
  handler: Handler<E, C>;
  getStaticPaths?: () => Promise<string[]> | string[];
  pregenerate?: true;
};

/**
 * Class to use as programmatic router (alternative to the file-based router).
 */
export class Mastro<E = void, C = void> {
  private routes: Route[] = [];

  /** Add route */
  addRoute(method: "all" | HttpMethod, pathname: string, opts: RouteOpts<E, C>): this {
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
  get(pathname: string, handler: RouteOpts<E, C>): this {
    return this.addRoute("GET", pathname, handler);
  }

  /** Add HTTP POST route */
  post(pathname: string, handler: RouteOpts<E, C>): this {
    return this.addRoute("POST", pathname, handler);
  }

  /** Add HTTP PUT route */
  put(pathname: string, handler: RouteOpts<E, C>): this {
    return this.addRoute("PUT", pathname, handler);
  }

  /** Add HTTP DELETE route */
  delete(pathname: string, handler: RouteOpts<E, C>): this {
    return this.addRoute("DELETE", pathname, handler);
  }

  /** Generate static site */
  async generate(opts?: GenerateOpts): Promise<void> {
    const modPath = `../generator.${importSuffix}`; // variable to prevent esbuild bundling
    const { generate } = await import(modPath);
    if (!opts) {
      opts = {};
    }
    opts.routes = this.routes;
    return generate(opts);
  }

  /** Create fetch handler */
  createHandler(opts: CreateHandlerOpts = {}): Handler<E, C> {
    opts.routes = this.routes;
    return createHandler(opts);
  }
}
