/**
 * This module exports more configurable functions to create a
 * [Mastro server](https://mastrojs.github.io/docs/install-setup/#start-a-server).
 * @module
 */

export type { GenerateOpts } from "../generator.ts";
export { defaultMiddlewares } from "../middleware/defaultMiddlewares.ts";
export { createHandler, type Middleware } from "../middleware/middleware.ts";
export { createFileRouter } from "../middleware/middlewares/fileRouter.ts";
export { type Handler, type HttpMethod, type Route, staticCacheControlVal } from "./common.ts";
export { Mastro } from "./programmaticRouter.ts";
