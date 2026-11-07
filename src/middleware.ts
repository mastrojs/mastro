import type { Handler } from "./core/mastro.ts";

/**
 * Request Middleware
 *
 * No need to wrap `ctx.fetchUpstream()` in try...catch – Mastro already does that for you
 * and returns a 500 Response with an `error` field that contains whatever value was thrown.
 * Be sure to check for `res.ok` if your middleware should behave differently for 4xx or 5xx.
 *
 * When doing static site generation (or asset generation),
 * suppress generation of a page by returning `new Response(null, { status: 404 })`.
 * The default logger warns about the 404, but generation still succeeds.
 * To change the file name of the generated file, set a `Content-Disposition` header on your
 * response to a filename (without directory separators), for example:
 *
 * ```
 * const { body, headers, status } = ctx.fetchUpstream(req);
 * headers.set("Content-Disposition", 'filename="file%20name.jpg"');
 * return new Response(body, { headers, status })`
 * ```
 */
export type Middleware<E = unknown[]> =
  | Handler<[Context<E>]>
  | {
      /** Name by which users can identify the middleware. */
      name: string;
      /** Fetch handler like `handler = (req, ctx) => ctx.fetchUpstream(req)` */
      handler: Handler<[Context<E>]>;
      /** Called by the static site generator. */
      getStaticPaths?: (ctx: GeneratorContextSimple) => Promise<string[]> | string[];
      /** Called by the static site generator after generating all pages. */
      afterGenerate?: (ctx: GeneratorContextSimple) => void;
    };

export type Context<E = unknown[]> = GeneratorContext<E> | ServerContext<E>;

export interface GeneratorContext<E = []> {
  fetchUpstream: Handler;
  mode: "generator";
  onlyPregenerate: boolean;
  extra: E;
}

export type GeneratorContextSimple = Omit<GeneratorContext, "fetchUpstream">;

export interface ServerContext<E> {
  fetchUpstream: Handler;
  mode: "server";
  environment: "development" | "production";
  extra: E;
}

export const chainMiddlewares = <E>(middlewares: Middleware<E>[]): Handler<[Context<E>]> => {
  const handlers = middlewares.map((m) => (typeof m === "function" ? m : m.handler));
  return (req, ctx) => {
    const dispatch = async (req: Request, index: number): Promise<Response> => {
      const handler = handlers[index];
      try {
        const res = handler
          ? await handler(req, { ...ctx, fetchUpstream: (nextReq) => dispatch(nextReq, index + 1) })
          : await ctx.fetchUpstream(req);
        if (!(res instanceof Response)) {
          const name = (handler || ctx.fetchUpstream).name || "<anonymous>";
          throw new Error(`Function '${name}' did not return a Response object`);
        }
        return res;
      } catch (error) {
        return Object.assign(new Response("500 Internal Server Error", { status: 500 }), { error });
      }
    };
    return dispatch(req, 0);
  };
};
