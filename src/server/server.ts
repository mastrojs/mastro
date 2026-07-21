/**
 * This module has a default export to create a
 * [Mastro server](https://mastrojs.github.io/docs/install-setup/#start-a-server)
 * using the default [file-based router](https://mastrojs.github.io/docs/routing/).
 * @module
 */

import { defaultMiddlewares } from "../middleware/defaultMiddlewares.ts";
import { createHandler } from "../middleware/middleware.ts";
import { createFileRouter } from "../middleware/middlewares/fileRouter.ts";

// import "./serveStaticFile.ts"; // make sure JSR sees that file

/**
 * Default export that can be passed to [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with the [deno serve](https://docs.deno.com/runtime/reference/cli/serve/) CLI.
 */
const defaultExport: { fetch: (req: Request) => Promise<Response> | Response } = {
  /** fetch handler */
  fetch: createHandler(defaultMiddlewares.concat(createFileRouter())),
};
export default defaultExport;
