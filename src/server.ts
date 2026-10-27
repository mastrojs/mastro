/**
 * Helpers to create Mastro apps with middleware suited for a Node.js server.
 * @module
 */

import { Mastro } from "./core/mastro.ts";
import type { Middleware } from "./middleware.ts";
import { createFileRouter } from "./middlewares/fileRouter.ts";
import { fingerprintAssets } from "./middlewares/fingerprintAssets.ts";
import { staticFiles } from "./middlewares/staticFiles/staticFiles.ts";
import { tsToJs } from "./middlewares/tsToJs.ts";

export const defaultMiddlewares: Middleware[] = [ fingerprintAssets, tsToJs, staticFiles ];

/**
 * Creates an app with the programmatic router.
 */
export const createApp = (): Mastro => {
  const app = new Mastro();
  app.middlewares = defaultMiddlewares;
  return app;
}

/**
 * Creates an app with the file-based router.
 */
export const createFileRouterApp = (): Mastro => {
  const app = new Mastro();
  app.middlewares = defaultMiddlewares.concat(createFileRouter());
  return app;
}
