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
  private middlewares: Middleware[] | Promise<Middleware[]> | undefined = undefined;

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
    return generate({ ...opts, middlewares: await this.getMiddlewares() });
  }

  /** Create fetch handler */
  createHandler(): Handler {
    const handlerP = this.getMiddlewares().then(chainMiddlewares);
    return req => handlerP.then(handler => handler(req, { mode: "server" }));
  }

  /** Add custom middlewares before default ones */
  addMiddlewares(...middlewares: Middleware[]): this {
    const modPath = `../middlewares.${importSuffix}`; // variable to prevent esbuild bundling
    this.middlewares = import(modPath).then((mod) => middlewares.concat(mod.defaultMiddlewares));
    return this;
  }

  /** Replace default middlewares with custom ones */
  setMiddlewares(...middlewares: Middleware[]): this {
    this.middlewares = middlewares;
    return this;
  }

  private async getMiddlewares(): Promise<Middleware[]> {
    if (!this.middlewares) this.addMiddlewares();
    return (await this.middlewares || []).concat(createMastroHandler({ routes: this.routes }));
  }
}
