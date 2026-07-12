/**
 * This module has a default export to create a
 * [Mastro server](https://mastrojs.github.io/docs/install-setup/#start-a-server)
 * using the default [file-based router](https://mastrojs.github.io/docs/routing/).
 * @module
 */

// import "./serveStaticFile.ts"; // make sure JSR sees that file
import { chainMiddlewares } from "../middleware.ts";
import { staticFiles } from "../middlewares/staticFiles.ts";
import { fileRoutes } from "../middlewares/fileRoutes.ts";

const fetchUpstream = () => new Response("Not found", { status: 404 });

const handler = chainMiddlewares([
  staticFiles,
  fileRoutes,
]);

/**
 * Default export that can be passed to [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with the [deno serve](https://docs.deno.com/runtime/reference/cli/serve/) CLI.
 */
const defaultExport: { fetch: (req: Request) => Promise<Response> | Response } = {
  /** fetch handler */
  fetch: req => handler(req, { mode: "server", fetchUpstream }),
};
export default defaultExport;
