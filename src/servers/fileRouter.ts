import { findFiles, sep } from "../core/fs.ts";
import { httpMethods, type Route } from "../core/mastro.ts";

interface FileRoute {
  name: string;
  pathname: string;
}
type RouteLoader = (fileName: string) => Promise<Record<string, unknown>>;

export const loadFileRoutes = async (): Promise<Route[]> => {
  const { pathToFileURL } = await import("node:url");
  const loader = (name: string) => import(pathToFileURL(process.cwd() + sep + name).toString());
  return loadRoutes(await findRoutes(), loader);
};

export const findRoutes = async (): Promise<FileRoute[]> => {
  const routeFiles = await findFiles([
    "routes/**/*.server.{ts,js}",
    "routes/**/.*/**/*.server.{ts,js}",
  ]);

  if (routeFiles.length === 0) {
    console.warn(
      "\n\nWARNING: No route files found!\n  see https://mastrojs.github.io/docs/routing/\n\n",
    );
  }
  return routeFiles.sort(compareRoutes).map((name) => ({ name, pathname: toPattern(name) }));
};

export const loadRoutes = async (routes: FileRoute[], loader: RouteLoader): Promise<Route[]> => {
  const modules = await Promise.all(
    routes.map(async ({ name, pathname }) => ({
      module: await loader(name),
      name,
      pattern: new URLPattern({ pathname }),
    })),
  );

  return modules.flatMap(({ module, name, pattern }) =>
    (typeof module.ALL === "function" ? (["ALL"] as const) : httpMethods).flatMap((method) => {
      const handler = module[method];
      return typeof handler === "function"
        ? ({
            name,
            handler: (req, ...extra) => {
              (req as any)._params = pattern.exec(req.url)?.pathname.groups;
              return handler(req, ...extra);
            },
            method: method === "ALL" ? "all" : method,
            pattern,
            getStaticPaths: module.getStaticPaths,
            pregenerate: module.pregenerate,
          } as Route)
        : [];
    }),
  );
};

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
};

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
  return "/" + parts.join("/");
};

const indexRegex = /^index(\.html)?\.server\.(ts|js)$/;
const paramRegex = /^\[([a-zA-Z0-9\.]+)\]/;
