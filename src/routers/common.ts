// @ts-ignore: Bun doesn't implement URLPattern: https://github.com/oven-sh/bun/issues/2286
if (typeof Bun === "object" && !globalThis.URLPattern) {
  // use variable to prevent esbuild from trying to bundle the import
  const polyfill = "urlpattern-polyfill";
  await import(polyfill);
}

/** Supported HTTP methods */
export const httpMethods = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"] as const;

/** Supported HTTP methods */
export type HttpMethod = (typeof httpMethods)[number];

/**
 * A fetch handler that takes a standard `Request` and returns a standard `Response`.
 * On some runtimes, there are two more arguments that Mastro passes through.
 */
export type Handler<E = void, C = void> = (
  req: Request,
  env: E,
  ctx: C,
) => Promise<Response> | Response;

/**
 * A Mastro Route
 */
export interface Route {
  /**
   * Name of the route for error messages etc.
   * For file-based routes the `filePath`, e.g. `/routes/index.server.ts`
   */
  name: string;
  /** Fetch handler */
  handler: Handler;
  /** HTTP method, or "all" if the route should match any HTTP method. */
  method: "all" | HttpMethod;
  /** `URLPattern` with `pathname` set */
  pattern: URLPattern;
  /** Called by the static site generator on routes with route parameters in the pattern. */
  getStaticPaths?: () => Promise<string[]> | string[];
  /** When running a server, set this to `true` to still build this route statically. */
  pregenerate?: true;
}
