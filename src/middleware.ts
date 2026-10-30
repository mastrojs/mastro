import type { Handler } from "./core/mastro.ts";

/**
 * Request Middleware
 *
 * When doing static site generation (or asset generation),
 * suppress generation of a page by returning `new Response(null, { status: 404 })`.
 * To change the file name of the generated file, set a `Content-Disposition` header on your
 * response, for example:
 *
 * ```
 * const { body, headers, status } = ctx.fetchUpstream(req);
 * headers.set("Content-Disposition", 'filename="file name.jpg"');
 * return new Response(body, { headers, status })`
 * ```
 */
export type Middleware<E extends unknown[] = unknown[]> =
  | MiddlewareHandler<E>
  | {
      /** Name by which users can filter the middlewares.  */
      name: string;
      /** Fetch handler */
      handler: MiddlewareHandler<E>;
      /** Called by the static site generator. */
      getStaticPaths?: (ctx: GeneratorContextBase) => Promise<string[]> | string[];
      /** Called by the static site generator when its done. */
      afterGenerate?: (ctx: GeneratorContextBase) => void;
    };

export type MiddlewareHandler<E extends unknown[] = unknown[]> = (
  req: Request,
  ctx: Context<E>,
) => Promise<Response> | Response;

export type Context<E extends unknown[] = unknown[]> = GeneratorContext | ServerContext<E>;
export interface GeneratorContextBase {
  mode: "generator";
  onlyPregenerate: boolean;
}
export interface GeneratorContext extends GeneratorContextBase {
  fetchUpstream: Handler;
  extra: [];
}
export interface ServerContext<E extends unknown[] = unknown[]> {
  fetchUpstream: Handler;
  mode: "server";
  environment: "development" | "production";
  extra: E;
}

export const chainMiddlewares = <E extends unknown[] = unknown[]>(
  middlewares: Middleware<E>[],
): MiddlewareHandler<E> => {
  const [m, ...rest] = middlewares;
  if (!m) return (req, ctx) => ctx.fetchUpstream(req); // base case of recursion

  const handler = typeof m === "function" ? m : m.handler;
  const next = chainMiddlewares(rest);
  return async (req, ctx) => {
    const res = await handler(req, { ...ctx, fetchUpstream: (nextReq) => next(nextReq, ctx) });
    if (!(res instanceof Response)) {
      throw new Error(`Function ${handler.name || "<anonymous>"} did not return a Response object`);
    } else if (res.status >= 500) {
      throw new Error(`Function ${handler.name || "<anonymous>"} returned HTTP ${
        res.status}: ${await res.text()}`);
    }
    // what about 404s and other non-200 responses?
    return res;
  };
};
