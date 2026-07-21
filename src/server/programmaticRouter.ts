import type { GenerateOpts } from "../generator.ts";
import { createHandler, type Middleware } from "../middleware/middleware.ts";
import type { Handler, HttpMethod, Route } from "../server/common.ts";
import { routesToHandler } from "./handler.ts";

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

  /** Generate static site */
  async generate(opts?: Omit<GenerateOpts, "routes" | "writeRoutenames">): Promise<void> {
    const modPath = `../generator.${importSuffix}`; // variable to prevent esbuild bundling
    const { generate } = await import(modPath);
    return generate({ ...opts, middlewares: await this.getMiddlewares() });
  }

  /** Create fetch handler */
  createHandler(): Handler {
    const handlerP = this.getMiddlewares().then(createHandler);
    return (req) => handlerP.then((handler) => handler(req));
  }

  /** Add custom middlewares before default ones */
  addMiddlewares(...middlewares: Middleware[]): this {
    const modPath = `../middleware/defaultMiddlewares.${importSuffix}`; // prevent esbuild bundling
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
    return (await this.middlewares || []).concat(routesToHandler({ routes: this.routes }));
  }
}

// Otherwise Node.js says "Stripping types is currently unsupported for files under node_modules"
// @ts-expect-error no type definitions for Bun
const importSuffix = typeof Deno === "object" || typeof Bun === "object" ? "ts" : "js";
