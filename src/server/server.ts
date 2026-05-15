/**
 * This module exports functions to create a
 * [Mastro server](https://mastrojs.github.io/docs/install-setup/#start-a-server)
 * using the default [file-based router](https://mastrojs.github.io/docs/routing/).
 * @module
 */

import { type BaseHandlerOpts, createMastroHandler } from "./handler.ts";
import type { Handler, Route } from "../routers/common.ts";
import { loadRoutes } from "../routers/fileRouter.ts";

export { loadRoutes };
export { staticCacheControlVal } from "../routers/common.ts";
export type { Handler, Route };

/**
 * Options for `createHandler`
 */
export interface CreateHandlerOpts extends BaseHandlerOpts {
  routes?: Route[];
}

/**
 * Create fetch handler that serves Mastro routes and static files
 */
export const createHandler = <E, C>(opts: CreateHandlerOpts): Handler<E, C> =>
  createMastroHandler({ ...opts, routes: opts.routes || loadRoutes() });
