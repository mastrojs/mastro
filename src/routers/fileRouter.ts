/**
 * This module exports functions to create a
 * [Mastro server](https://mastrojs.github.io/docs/install-setup/#start-a-server).
 * using the default [file-based router](https://mastrojs.github.io/docs/routing/).
 * @module
 */

import { findFiles } from "../core/fs.ts";
import { type BaseHandlerOpts, createMastroHandler } from "../server.ts";
import { type Handler, httpMethods, type Route } from "./common.ts";

export { staticCacheControlVal } from "./common.ts";
export type { Handler, Route };

type Loader = (fileName: string) => Promise<Record<string, unknown>>;

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
export const createHandler = (opts: CreateHandlerOpts) =>
  createMastroHandler({ ...opts, routes: loadRoutes(opts.routeFiles) });

/**
 * Returns an array of the file-based routes from `routes/`, loaded with the provided `loader`.
 * Called from the Mastro VSCode extension.
 */
export const loadRoutes = async (routeFiles?: string[], loader?: Loader): Promise<Route[]> => {
  if (!routeFiles) {
    routeFiles = await findFiles("routes/**/*.server.{ts,js}");
  }
  if (!loader) {
    const { pathToFileURL } = await import("node:url");
    loader = (fileName) => import(pathToFileURL(process.cwd() + sep + fileName).toString());
  }
  return loadFileBasedRoutes(routeFiles, loader);
};

/**
 * Default export with a `fetch` handler.
 *
 * Can be passed to [Deno.serve](https://docs.deno.com/api/deno/~/Deno.serve),
 * or used directly with the [deno serve](https://docs.deno.com/runtime/reference/cli/serve/) CLI.
 */
const defaultExport: { fetch: (req: Request) => Promise<Response> | Response } = {
  fetch: createMastroHandler<void, void>({ routes: loadRoutes() }),
};
export default defaultExport;

/**
 * Returns true iff the given `filePath` contains dynamic route parameters.
 */
export const hasRouteParams = (filePath: string): boolean =>
  filePath.split(sep).some((segment) => segment.match(paramRegex));

const loadFileBasedRoutes = async (routeFiles: string[], loader: Loader): Promise<Route[]> => {
  if (routeFiles.length === 0) {
    console.warn([
      "",
      "WARNING: No route files found!",
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

const paramRegex = /^\[([a-zA-Z0-9\.]+)\]/;

const sep: string = typeof document === "object" ? "/" : (await import("node:path")).sep;
