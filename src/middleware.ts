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
  /** Fetch handler */
  handler: MiddlewareHandler,
  /** Called by the static site generator on routes with route parameters in the pattern. */
  getStaticPaths?: () => Promise<string[]> | string[];
}

export type MiddlewareHandler = (req: Request, ctx: Context) => Promise<Response> | Response;

export interface Context {
  fetchUpstream: Handler;
  mode: "generator" | "prodServer" | "devServer";
}

export const chainMiddlewares = (middlewares: Middleware[]): MiddlewareHandler => {
  const [m, ...rest] = middlewares;
  if (!m) return (req, ctx) => ctx.fetchUpstream(req); // base case of recursion

  const handler = typeof m === "function" ? m : m.handler;
  const next = chainMiddlewares(rest);
  return async (req, ctx) => {
    const res = await handler(req, { ...ctx, fetchUpstream: (nextReq) => next(nextReq, ctx) });
    if (!(res instanceof Response)) {
      throw new Error(`Function ${handler.name || "<anonymous>"} did not return a Response object`);
    } else if (res.status >= 500) {
      throw new Error(`Function ${handler.name || "<anonymous>"} returned HTTP ${res.status}: ${await res.text()}`);
    }
    // what about 404s and other non-200 responses?
    return res;
  };
};
