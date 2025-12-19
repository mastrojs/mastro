import { findFiles, sep } from "../core/fs.ts";
import { httpMethods, type Route } from "./common.ts";

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
      loader = (fileName) => import(pathToFileURL(process.cwd() + fileName).toString());
    }
    // don't await routes to speed up server startup
    routes = loadFileBasedRoutes(loader);
  }
  return routes;
};

const loadFileBasedRoutes = async (
  loader: (fileName: string) => Promise<Record<string, unknown>>,
): Promise<Route[]> => {
  const suffix = typeof document === "object" ? "js" : "{ts,js}";
  const routeFiles = await findFiles(`routes/**/*.server.${suffix}`);

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
  const pathParts = filePath.split(sep).slice(2);
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
