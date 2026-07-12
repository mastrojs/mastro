
import { findFiles, sep } from "../core/fs.ts";
import type { Middleware } from "../middleware.ts";
import { httpMethods, type Route } from "../routers/common.ts";
import { createMastroHandler } from "../server/handler.ts";

/**
 * Loads and returns file-based routes – either with the provided `loader`, or falling back to
 * reading the `routes/` folder from the file system.
 * You only need to call this manually when using a bundler like esbuild, where we don't have the
 * route file names in the bundle.
 *
 * Also called from the Mastro VSCode extension.
 */
export const loadRoutes = async (
  routeFiles?: string[],
  loader?: (fileName: string) => Promise<Record<string, unknown>>,
): Promise<Route[]> => {
  if (!routeFiles) {
    routeFiles = await findFiles([
      "routes/**/*.server.{ts,js}",
      "routes/**/.*/**/*.server.{ts,js}",
    ]);
  }
  if (!loader) {
    const { pathToFileURL } = await import("node:url");
    loader = (fileName) => import(pathToFileURL(process.cwd() + sep + fileName).toString());
  }

  if (routeFiles.length === 0) {
    console.warn([
      "",
      "WARNING: No route files found!",
      "  see https://mastrojs.github.io/docs/routing/",
      "",
    ].join("\n"));
  }
  routeFiles.sort(compareRoutes);

  const modules = await Promise.all(routeFiles.map(async (name) => (
    { module: await loader(name), name, pattern: toPattern(name) }
  )));

  return modules.flatMap(({ module, name, pattern }) =>
    (typeof module.ALL === "function" ? ["ALL"] as const : httpMethods).flatMap((method) =>
      module[method]
        ? {
          name,
          handler: req => {
            (req as any)._params = pattern.exec(req.url)?.pathname.groups;
            return module[method](req);
          },
          method: method === "ALL" ? "all" : method,
          pattern,
          getStaticPaths: module.getStaticPaths,
          pregenerate: module.pregenerate,
        } as Route
        : []
    )
  );
};

/**
 * Returns true iff the given `filePath` contains dynamic route parameters.
 */
export const hasRouteParams = (filePath: string): boolean =>
  filePath.split(sep).some((segment) => segment.match(paramRegex));

/**
 * Perhaps we should sort this according to more solid route precedence criteria.
 * Currently, it's just reverse alphabetical order, which at least guarantees that
 * - [...slug] loses out over more specific routes that start with a lowercase char
 * - longer paths win over their prefixes.
 *
 * And we have an exception for character 7 so that e.g.`routes/.well-known/foo.server.ts`
 * takes precedence over `routes/[...slug].server.ts`
 */
const compareRoutes = (a: string, b: string) => {
  if (a[7] === "[" && b[7] !== "[") return 1;
  if (b[7] === "[" && a[7] !== "[") return -1;
  return a < b ? 1 : -1;
}

const toPattern = (filePath: string) => {
  const pathParts = filePath.split(sep).slice(1);
  const parts = pathParts.map((part, i) => {
    const param = part.match(paramRegex)?.[1];
    if (param) {
      return param.startsWith("...") ? `:${param.slice(3)}(.*)?` : `:${param}`;
    } else if (indexRegex.test(part)) {
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

const indexRegex = /^index(\.html)?\.server\.(ts|js)$/
const paramRegex = /^\[([a-zA-Z0-9\.]+)\]/;




const routes = loadRoutes();

export const fileRoutes: Middleware = {
  name: "fileRoutes",
  getStaticPaths: async () => {
    const rs = await routes;
    const paths = await Promise.all(
      rs.map(r => "getStaticPaths" in r ? (r.getStaticPaths?.() || []) : [])
    );
    return paths.flatMap(p => p);
  },
  handler: createMastroHandler({ routes })
}

