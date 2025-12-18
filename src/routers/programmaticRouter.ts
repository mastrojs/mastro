import { generate, type GenerateOpts } from "../generator.ts";
import { createHandler, type CreateHandlerOpts } from "../server.ts";
import type { Handler, HttpMethod, Route } from "./common.ts";

/**
 * Class to use as programmatic router (alternative to the file-based router).
 */
export class Mastro {
  private routes: Route[] = [];

  /** Add route */
  addRoute(method: "all" | HttpMethod, pathname: string, handler: Handler): this {
    this.routes.push({
      name: pathname,
      handler,
      method,
      pattern: new URLPattern({ pathname }),
      // TODO: getStaticPaths and pregenerate
    });
    return this;
  }

  /** Add HTTP GET route */
  get(pathname: string, handler: Handler): this {
    return this.addRoute("GET", pathname, handler);
  }

  /** Add HTTP POST route */
  post(pathname: string, handler: Handler): this {
    return this.addRoute("POST", pathname, handler);
  }

  /** Add HTTP PUT route */
  put(pathname: string, handler: Handler): this {
    return this.addRoute("PUT", pathname, handler);
  }

  /** Add HTTP DELETE route */
  delete(pathname: string, handler: Handler): this {
    return this.addRoute("DELETE", pathname, handler);
  }

  /** Generate static site */
  generate(opts?: GenerateOpts): Promise<void> {
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
