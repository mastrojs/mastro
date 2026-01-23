import type { GenerateOpts } from "../generator.ts";
import { createHandler, type CreateHandlerOpts, importSuffix } from "../server.ts";
import type { Handler, HttpMethod, Route } from "./common.ts";

export type RouteOpts = {
  handler: Handler;
  getStaticPaths?: () => Promise<string[]> | string[];
  pregenerate?: true;
}

/**
 * Class to use as programmatic router (alternative to the file-based router).
 */
export class Mastro {
  private routes: Route[] = [];

  /** Add route */
  addRoute(method: "all" | HttpMethod, pathname: string, opts: Handler | RouteOpts): this {
    if (typeof opts === "function") {
      opts = { handler: opts };
    }
    this.routes.push({
      name: pathname,
      method,
      pattern: new URLPattern({ pathname }),
      ...opts,
    });
    return this;
  }

  /** Add HTTP GET route */
  get(pathname: string, handler: Handler | RouteOpts): this {
    return this.addRoute("GET", pathname, handler);
  }

  /** Add HTTP POST route */
  post(pathname: string, handler: Handler | RouteOpts): this {
    return this.addRoute("POST", pathname, handler);
  }

  /** Add HTTP PUT route */
  put(pathname: string, handler: Handler | RouteOpts): this {
    return this.addRoute("PUT", pathname, handler);
  }

  /** Add HTTP DELETE route */
  delete(pathname: string, handler: Handler | RouteOpts): this {
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
  createHandler(opts: CreateHandlerOpts = {}): Handler {
    opts.routes = this.routes;
    return createHandler(opts);
  }
}
