import { urlPathToFilePath, type FilePath, findFiles } from "../core/fs.ts";
import { httpMethods, type Route } from "../core/mastro.ts";

interface FileRoute {
  name: string;
  pathname: string;
}
type RouteLoader = (fileName: string) => Promise<Record<string, unknown>>;

export const loadFileRoutes = async (): Promise<Route[]> => {
  const { pathToFileURL } = await import("node:url");
  const loader = (name: string) => import(pathToFileURL(process.cwd() + "/" + name).toString());
  return loadRoutes(await findRoutes(), loader);
};

export const findRoutes = async (): Promise<FileRoute[]> => {
  const files = await findFiles(["routes/**/*.server.{ts,js}", "routes/**/.*/**/*.server.{ts,js}"]);
  if (files.length === 0) console.warn(noRt);
  return files.map(urlPathToFilePath).sort(cmp).map((n) => ({ name: n, pathname: toPattern(n) }));
};
const noRt = "\n\nWARNING: No route files found!\n  see https://mastrojs.github.io/docs/routing/\n";

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
            handler,
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
 * Compare routes according to reverse alphabetical order, with the exception that `[` goes last.
 * This guarantees us at least that:
 * - dynamic segments lose out over fixed segments at every depth
 * - longer paths win over their prefixes.
 */
const cmp = (a: string, b: string) => a.replaceAll("[", "\0") < b.replaceAll("[", "\0") ? 1 : -1;

const toPattern = (filePath: FilePath) => {
  const pathParts = filePath.split("/").slice(1);
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
    }
    return encodeURIComponent(
      part.endsWith(".server.ts") || part.endsWith(".server.js") ? part.slice(0, -10) : part,
    ).replace(/[()*]/g, "\\$&"); // escape characters that have special meaning in URLPattern
  });
  return "/" + parts.join("/");
};

const indexRegex = /^index(\.html)?\.server\.(ts|js)$/;
const paramRegex = /^\[([a-zA-Z0-9\.]+)\]/;
