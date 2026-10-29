/**
 * Helpers to create Mastro apps with middleware suited for a Node.js server.
 * @module
 */

import { Mastro } from "../core/mastro.ts";
import type { Middleware } from "../middleware.ts";
import { loadFileRoutes } from "./fileRouter.ts";
import { fingerprintAssets } from "../middlewares/fingerprintAssets.ts";
import { staticFiles } from "../middlewares/staticFiles/staticFiles.ts";
import { tsToJs } from "../middlewares/tsToJs.ts";

export { fingerprintAssets, tsToJs, staticFiles };
export const middlewares: Middleware[] = [ fingerprintAssets, tsToJs, staticFiles ];

/**
 * Creates an app with the programmatic router.
 */
export const createApp = (): Mastro =>
  new Mastro({ middlewares });

/**
 * Creates an app with the file-based router.
 */
export const createFileRouterApp = (): Mastro =>
  new Mastro({ middlewares, routes: loadFileRoutes() });
