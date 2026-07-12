import type { Handler } from "./routers/common.ts";

/**
 * Request Middleware
 *
 * To suppress generation of this page, return `new Response(null, { status: 404 })`
 *
 * When doing static site generation (or asset generation),
 * To change the file name of the generated file, set a `Content-Disposition` header on your
 * response, for example:
 * ```
 * const { body, headers, status } = ctx.fetchUpstream(req);
 * headers.set("Content-Disposition", 'filename="file name.jpg"');
 * return new Response(body, { headers, status })`
 * ```
 */
export type Middleware = MiddlewareHandler | {
  /**
   * Name of the route for error messages etc.
   * For file-based routes the `filePath`, e.g. `/routes/index.server.ts`
   */
  name: string;
  /** Fetch handler */
  handler: MiddlewareHandler,
  /** Called by the static site generator on routes with route parameters in the pattern. */
  getStaticPaths?: () => Promise<string[]> | string[];
}

export type MiddlewareHandler = (req: Request, ctx: Context) => Promise<Response> | Response;

interface Context {
  fetchUpstream: Handler;
  mode: "generator" | "server";
}

export class MiddlewareError extends Error {
  constructor(public middlewareName: string, msg?: string, cause?: unknown) {
    super(msg, { cause });
  }
}

export const chainMiddlewares = (middlewares: Middleware[]): MiddlewareHandler => {
  const [m, ...rest] = middlewares;
  if (!m) return (req, ctx) => ctx.fetchUpstream(req); // base case of recursion

  const name = m.name || "<anonymous>";
  const handler = typeof m === "function" ? m : m.handler;
  const next = chainMiddlewares(rest);
  return async (req, ctx) => {
    let res: Response;
    try {
      res = await handler(req, { ...ctx, fetchUpstream: (nextReq) => next(nextReq, ctx) });
    } catch (err) {
      throw err instanceof MiddlewareError ? err : new MiddlewareError(name, undefined, err);
    }
    if (!(res instanceof Response)) {
      throw new MiddlewareError(name, "function must return a Response object");
    }
    if (res.status >= 500) {
      throw new MiddlewareError(name, `received HTTP ${res.status}: ${await res.text()}`);
    }
    return res;
  };
};
