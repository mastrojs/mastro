/**
 * Helpers to create Mastro apps with middleware suited for a Node.js server.
 * @module
 */

import { Mastro } from "../core/mastro.ts";
import type { Middleware } from "../middleware.ts";
import { fingerprintAssets } from "../middlewares/fingerprintAssets.ts";
import { logger } from "../middlewares/logger.ts";
import { staticFiles } from "../middlewares/staticFiles/staticFiles.ts";
import { tsToJs } from "../middlewares/tsToJs.ts";
import { loadFileRoutes } from "./fileRouter.ts";

export { logger, fingerprintAssets, tsToJs, staticFiles };
export const middlewares: Middleware[] = [logger, fingerprintAssets, tsToJs, staticFiles];

/**
 * Creates an app with the programmatic router.
 */
export const createApp = <E extends unknown[]>(): Mastro<E> =>
  new Mastro({ middlewares });

/**
 * Creates an app with the file-based router.
 */
export const createFileRouterApp = <E extends unknown[]>(): Mastro<E> =>
  new Mastro({ middlewares, routes: loadFileRoutes() });
