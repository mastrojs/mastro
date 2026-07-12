/**
 * This module exports more configurable functions to create a
 * [Mastro server](https://mastrojs.github.io/docs/install-setup/#start-a-server)
 * using the default [file-based router](https://mastrojs.github.io/docs/routing/).
 * @module
 */

import { findFiles, sep } from "../core/fs.ts";
import { type CreateHandlerOpts, createMastroHandler } from "../server/handler.ts";
import { type Handler, httpMethods, type Route } from "./common.ts";

export type { CreateHandlerOpts, Handler, Route };
export { staticCacheControlVal } from "./common.ts";

/**
 * Create fetch handler that serves Mastro routes and static files
 */
const createHandler = (opts?: CreateHandlerOpts): Handler =>
  createMastroHandler({ ...opts, routes: opts?.routes || loadRoutes() });
