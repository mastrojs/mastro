import { findFiles } from "./fs.ts";

if (!globalThis.URLPattern) {
  // implemented in Chrome, Deno and Node >=23.8.0
  // to be implemented by all browsers soon:
  // see https://wpt.fyi/results/urlpattern?q=label%3Ainterop-2025-urlpattern
  await import(`https://esm.sh/${'urlpattern-polyfill@10.1.3'}?bundle`);
}

export const sep = typeof document === "object" ? "/" : (await import("@std/path")).SEPARATOR;
export const paramRegex = /^\[([a-zA-Z0-9\.]+)\]/;

const pathSegments = [];
const suffix = typeof document === "object" ? "js" : "{ts,js}";
for (const filePath of await findFiles(`routes/**/*.server.${suffix}`)) {
  const fileSegments = filePath.split(sep).slice(2)
  const segments = fileSegments.map((segment, i) => {
    const param = segment.match(paramRegex)?.[1];
    if (param) {
      return param.startsWith("...")
        ? `:${param.slice(3)}(.*)?`
        : `:${param}`;
    }
    const parent = fileSegments[i-1];
    if (segment === "index.server.ts" || segment === "index.server.js") {
      return "";
    } else if (parent && (segment === `(${parent}).server.ts` || segment === `(${parent}).server.js`)) {
      return "";
    } else if (segment.endsWith(".server.ts") || segment.endsWith(".server.js")) {
      return segment.slice(0, -10);
    } else {
      return segment;
    }
  });
  pathSegments.unshift({ filePath, segments });
}

// TODO: sort this according to solid route precedence criteria
// pathSegments.sort((a, b) => a.segments.length - b.segments.length);

/**
 * Array containing all routes that Mastro found.
 * Useful for debugging. Also used by `matchRoute` below,
 * and the static site generator (both extension and `generator.ts`).
 */
export const routes: Readonly<Array<{ filePath: string; pattern: URLPattern }>> = pathSegments.map(
  (r) => {
    const route = {
      filePath: r.filePath,
      pattern: new URLPattern({
        // URLPattern only accepts forward slashes, but in other places we need to use `sep`
        // see https://github.com/denoland/deno/pull/987#issuecomment-438573356
        pathname: "/" + r.segments.join("/"),
      }),
    };
    Object.freeze(route);
    return route;
  },
);
Object.freeze(routes);

/**
 * Take the path of a URL and find the first matching route.
 * This function is mainly used internally by the Mastro server and static site generator.
 */
export const matchRoute = (
  urlPath: string,
): { filePath: string; params: Record<string, string | undefined> } | undefined => {
  for (const route of routes) {
    const match = route.pattern.exec(urlPath);
    if (match) {
      const { filePath } = route;
      if (typeof document === "object" && filePath.endsWith(".server.ts")) {
        throw Error(
          "TypeScript files are currently not supported in the " +
            ` Mastro VSCode extension (${filePath})`,
        );
      }
      return {
        filePath,
        params: match.pathname.groups || {},
      };
    }
  }
};

/**
 * Take the path of a URL and extract its parameters.
 * See the [Mastro Guide](https://mastrojs.github.io/guide/static-blog-from-markdown-files/#detail-pages).
 *
 * For example in `routes/[slug].server.ts`:
 *
 * ```ts
 * import { getParams, html, htmlToResponse } from "mastro";
 *
 * export const GET = async (req) => {
 *   const { slug } = getParams(req.url);
 *   return htmlToResponse(html`Hello ${slug}`);
 * }
 */
export const getParams = (urlPath: string): Record<string, string | undefined> =>
  matchRoute(urlPath)?.params || {};
