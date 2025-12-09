/** Supported HTTP methods */
export const httpMethods = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"] as const;

/** Supported HTTP methods */
export type HttpMethod = (typeof httpMethods)[number];

/** A fetch handler that takes a standard `Request` and returns a standard `Response` */
export type Handler = (req: Request) => Promise<Response> | Response;

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
