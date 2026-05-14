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
  /** When using e.g. esbuild, the route file names need to be supplied, because the individual file
   * names are not accessible in the bundle, but we need them to create the routes array. */
  routeFiles?: string[];
}

/**
 * Create fetch handler that serves Mastro routes and static files
 */
export const createHandler = <E, C>(opts: CreateHandlerOpts): Handler<E, C> =>
  createMastroHandler({ ...opts, routes: loadRoutes(opts.routeFiles) });

/**
 * Default export that can be passed to [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with the [deno serve](https://docs.deno.com/runtime/reference/cli/serve/) CLI.
 */
const defaultExport: { fetch: (req: Request) => Promise<Response> | Response } = {
  /** fetch handler */
  fetch: createMastroHandler<void, void>({ routes: loadRoutes() }),
};
export default defaultExport;
