export const httpMethods = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"] as const;
export type HttpMethod = (typeof httpMethods)[number];

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
  handler: Handler;
  method: "all" | HttpMethod;
  /** `URLPattern` with `pathname` set */
  pattern: URLPattern;
  getStaticPaths?: () => Promise<string[]> | string[];
  pregenerate?: true;
}
