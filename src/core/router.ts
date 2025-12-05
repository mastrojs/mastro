import { findFiles, sep } from "./fs.ts";

// @ts-ignore: Bun doesn't implement URLPattern: https://github.com/oven-sh/bun/issues/2286
if (typeof Bun === "object" && !globalThis.URLPattern) {
  // use variable to prevent esbuild from trying to bundle the import
  const polyfill = "urlpattern-polyfill";
  await import(polyfill);
}

/**
 * A Mastro Route
 */
export interface Route {
  /** For file-based routes the `filePath`, e.g. `/routes/index.server.ts` */
  name: string;
  /**
   * Module namespace object loaded by `import(route.name)`.
   * To speed up server startup, we await the import promise only once the route is requested.
   */
  module: Promise<Record<string, unknown>> | Record<string, unknown>;
  /** `URLPattern` with `pathname` set */
  pattern: URLPattern;
}

let routes: Route[] | undefined;

/**
 * Routes getter
 *
 * If routes have not been previously set, it loads them from the `routes` directory.
 */
export const getRoutes = async (): Promise<Route[]> => {
  if (!routes) {
    routes = await getDefaultRoutes();
  }
  return routes;
};

/**
 * Routes setter
 */
export const setRoutes = (newRoutes: Route[]): void => {
  routes = newRoutes;
};

const getDefaultRoutes = async () => {
  const { pathToFileURL } = await import("node:url");
  return routePathPatterns().then((ps) =>
    ps.map(({ name, pattern }) => ({
      name,
      module: import(pathToFileURL(process.cwd() + name).toString()),
      pattern,
    }))
  );
}

/**
 * Returns an array of the file-based routes from `routes/`, but without any loaded modules.
 * Useful when using esbuild (e.g. with Cloudflare Wrangler).
 * Also used in the Mastro vscode extension.
 */
export const routePathPatterns = async (): Promise<Array<Omit<Route, "module">>> => {
  const suffix = typeof document === "object" ? "js" : "{ts,js}";
  const routeFiles = await findFiles(`routes/**/*.server.${suffix}`);
  const pathPatterns = routeFiles.map((name) => ({ name, pattern: toPattern(name) }));

  // TODO: sort this according to more solid route precedence criteria
  // currently, it's just reverse alphabetical order, which at least guarantees that
  // - [...slug] loses out over more specific routes that start with a lowercase char
  // - longer paths win over their prefixes.
  return pathPatterns.sort((a, b) => a.name < b.name ? 1 : -1);
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
 * Take the path of a URL and extract its parameters.
 * See the [Mastro Guide](https://mastrojs.github.io/guide/static-blog-from-markdown-files/#detail-pages).
 *
 * For example in `routes/[slug].server.ts`:
 *
 * ```ts
 * import { getParams, html, htmlToResponse } from "@mastrojs/mastro";
 *
 * export const GET = (req) => {
 *   const { slug } = getParams(req.url);
 *   return htmlToResponse(html`Hello ${slug}`);
 * }
 */
export const getParams = (urlPath: string): Record<string, string | undefined> => {
  if (!routes) throw Error(`Call getRoutes or setRoutes once before getParams`);
  for (const route of routes) {
    const match = route.pattern.exec(urlPath);
    if (match) {
      return match.pathname.groups;
    }
  }
  return {};
};

/**
 * Returns true iff the given `filePath` contains dynamic route parameters.
 */
export const hasRouteParams = (filePath: string): boolean =>
  filePath.split(sep).some((segment) => segment.match(paramRegex));

const paramRegex = /^\[([a-zA-Z0-9\.]+)\]/;
