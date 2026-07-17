/**
 * This module has a default export to create a
 * [Mastro server](https://mastrojs.github.io/docs/install-setup/#start-a-server)
 * using the default [file-based router](https://mastrojs.github.io/docs/routing/).
 * @module
 */

// import "./serveStaticFile.ts"; // make sure JSR sees that file
import { chainMiddlewares, MiddlewareError } from "../middleware.ts";
import { staticFiles } from "../middlewares/staticFiles/staticFiles.ts";
import { fileRoutes } from "../middlewares/fileRoutes.ts";
import { tsToJs } from "../middlewares/tsToJs.ts";

const fetchUpstream = () => new Response("Not found", { status: 404 });

const handler = chainMiddlewares([
  tsToJs,
  staticFiles,
  fileRoutes,
]);

const fetch = async (req: Request) => {
  try {
    return await handler(req, { mode: "server", fetchUpstream });
  } catch (err: any) {
    const [e, msg] = err instanceof MiddlewareError
      ? [err.cause, ` in middleware "${err.middlewareName}"`]
      : [err, ""];
    const isDev = true // TODO
    return new Response(`500 Internal Server Error${msg}\n\n${isDev ? (e.stack || e) : e.name || "Unknown error"}`, { status: 500 });
  }
}
/**
 * Default export that can be passed to [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with the [deno serve](https://docs.deno.com/runtime/reference/cli/serve/) CLI.
 */
const defaultExport: { fetch: (req: Request) => Promise<Response> | Response } = {
  /** fetch handler */
  fetch,
};
export default defaultExport;
