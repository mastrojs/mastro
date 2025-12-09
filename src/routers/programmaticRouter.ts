import { generate, type GenerateConfig } from "../generator.ts";
import { createHandler } from "../server.ts";
import type { Handler, HttpMethod, Route } from "./common.ts";

/**
 * Class to use as programmatic router (alternative to the file-based router).
 */
export class Mastro {
  private routes: Route[] = [];

  addRoute(method: HttpMethod, pathname: string, handler: Handler) {
    this.routes.push({
      name: pathname,
      handler,
      method,
      pattern: new URLPattern({ pathname }),
      // TODO: getStaticPaths and pregenerate
    });
    return this;
  }

  get(pathname: string, handler: Handler) {
    return this.addRoute("GET", pathname, handler);
  }

  post(pathname: string, handler: Handler) {
    return this.addRoute("POST", pathname, handler);
  }

  put(pathname: string, handler: Handler) {
    return this.addRoute("PUT", pathname, handler);
  }

  delete(pathname: string, handler: Handler) {
    return this.addRoute("DELETE", pathname, handler);
  }

  generate(config?: GenerateConfig) {
    if (!config) {
      config = {};
    }
    config.routes = this.routes;
    return generate(config);
  }

  getHandler() {
    return createHandler({ routes: this.routes });
  }
}
