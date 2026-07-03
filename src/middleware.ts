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
export type Middleware = (req: Request, ctx: Context) => Promise<Response> | Response;

interface Context {
  fetchUpstream: Handler;
  mode: "generator" | "server";
}

export const chainMiddlewares = (middlewares: Middleware[]): Middleware => {
  const [middleware, ...nextMiddlewares] = middlewares;
  if (!middleware) return (req, ctx) => ctx.fetchUpstream(req);
  const next = chainMiddlewares(nextMiddlewares);
  return (req, ctx) =>
    middleware(req, {
      ...ctx,
      fetchUpstream: async (nextReq) => {
        const res = await next(nextReq, ctx);
        if (!res.ok) throw `middleware received HTTP ${res.status}: ${await res.text()}`;
        return res;
      },
    });
};
