/**
 * Helpers to create Mastro apps with middleware suited for a Node.js server.
 * @module
 */

import { Mastro } from "../mastro.ts";
import { fingerprintAssets } from "../middlewares/fingerprintAssets.ts";
import { logger } from "../middlewares/logger.ts";
import { staticFiles } from "../middlewares/staticFiles/staticFiles.ts";
import { tsToJs } from "../middlewares/tsToJs.ts";
import type { Route } from "../types/mastro.js";
import type { Middleware } from "../types/middleware.d.ts";
import { loadFileRoutes } from "./fileRouter.ts";

/**
 * Array with the default middlewares in correct order:
 *
 * - {@link logger}
 * - {@link fingerprintAssets}
 * - {@link tsToJs}
 * - {@link staticFiles}
 */
export const middlewares: Middleware[] = [logger, fingerprintAssets, tsToJs, staticFiles];
export { logger, fingerprintAssets, tsToJs, staticFiles };

/**
 * Creates a {@link Mastro} app with the programmatic [router](https://mastrojs.github.io/docs/routing/) and default middleware.
 */
export const createApp = <E extends unknown[]>(): Mastro<E> =>
  new Mastro<E>().use(logger).use(fingerprintAssets).use(tsToJs).use(staticFiles);

/**
 * Creates a {@link Mastro} app with the file-based [router](https://mastrojs.github.io/docs/routing/) and default middleware.
 */
export const createFileRouterApp = <E extends unknown[]>(routes?: Promise<Route[]>): Mastro<E> =>
  new Mastro<E>({ routes: routes || loadFileRoutes() })
    .use(logger).use(fingerprintAssets).use(tsToJs).use(staticFiles);
