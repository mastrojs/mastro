/**
 * This module exports functions to create a
 * [Mastro server](https://mastrojs.github.io/docs/install-setup/#start-a-server).
 * using the default [file-based router](https://mastrojs.github.io/docs/routing/).
 * @module
 */

import { findFiles } from "../core/fs.ts";
import { createHandler, type CreateHandlerOpts } from "../server.ts";
import { type Handler, httpMethods, type Route } from "./common.ts";

export { createHandler };
export type { CreateHandlerOpts, Handler, Route };

const sep: string = typeof document === "object" ? "/" : (await import("node:path")).sep;

/**
 * Default export with a `fetch` handler.
 *
 * Can be passed to [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with the [deno serve](https://docs.deno.com/runtime/reference/cli/serve/) CLI.
 */
const defaultExport: { fetch: (req: Request) => Promise<Response> | Response } = {
  fetch: createHandler<void, void>(),
};
export default defaultExport;

let routes: Promise<Route[]> | Route[] | undefined;

/**
 * Returns an array of the file-based routes from `routes/`, loaded with the provided `loader`.
 * Custom loader is useful when using esbuild (e.g. with Cloudflare Wrangler), or
 * in the Mastro VSCode extension.
 */
export const loadRoutes = async (
  loader?: (fileName: string) => Promise<Record<string, unknown>>,
): Promise<Route[]> => {
  if (!routes) {
    if (!loader) {
      const { pathToFileURL } = await import("node:url");
      loader = (fileName) => import(pathToFileURL(process.cwd() + sep + fileName).toString());
    }
    // don't await routes to speed up server startup
    routes = loadFileBasedRoutes(loader);
  }
  return routes;
};

const loadFileBasedRoutes = async (
  loader: (fileName: string) => Promise<Record<string, unknown>>,
): Promise<Route[]> => {
  const pattern = `routes/**/*.server.${typeof document === "object" ? "js" : "{ts,js}"}`;
  const routeFiles = await findFiles(pattern);
  if (routeFiles.length === 0) {
    console.warn([
      "",
      "WARNING: No route files found!",
      `  searched for ${pattern} in current working directory.`,
      "  see https://mastrojs.github.io/docs/routing/",
      "",
    ].join("\n"));
  }

  // Perhaps we should sort this according to more solid route precedence criteria.
  // Currently, it's just reverse alphabetical order, which at least guarantees that
  // - [...slug] loses out over more specific routes that start with a lowercase char
  // - longer paths win over their prefixes.
  routeFiles.sort((a, b) => a < b ? 1 : -1);

  const modules = await Promise.all(routeFiles.map(async (name) => (
    { module: await loader(name), name, pattern: toPattern(name) }
  )));

  return modules.flatMap(({ module, name, pattern }) =>
    (typeof module.ALL === "function" ? ["ALL"] as const : httpMethods).flatMap((method) =>
      module[method]
        ? {
          name,
          handler: module[method],
          method: method === "ALL" ? "all" : method,
          pattern,
          getStaticPaths: module.getStaticPaths,
          pregenerate: module.pregenerate,
        } as Route
        : []
    )
  );
};

const toPattern = (filePath: string) => {
  const pathParts = filePath.split(sep).slice(1);
  const parts = pathParts.map((part, i) => {
    const param = part.match(paramRegex)?.[1];
    if (param) {
      return param.startsWith("...") ? `:${param.slice(3)}(.*)?` : `:${param}`;
    } else if (part === "index.server.ts" || part === "index.server.js") {
      return "";
    }
    const folder = pathParts[i - 1];
    if (folder && (part === `(${folder}).server.ts` || part === `(${folder}).server.js`)) {
      return "";
    } else if (part.endsWith(".server.ts") || part.endsWith(".server.js")) {
      return part.slice(0, -10);
    } else {
      return part;
    }
  });
  return new URLPattern({ pathname: "/" + parts.join("/") });
};

/**
 * Returns true iff the given `filePath` contains dynamic route parameters.
 */
export const hasRouteParams = (filePath: string): boolean =>
  filePath.split(sep).some((segment) => segment.match(paramRegex));

const paramRegex = /^\[([a-zA-Z0-9\.]+)\]/;
