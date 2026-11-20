import type { Handler } from "./types/mastro.d.ts";
import type { Context, Middleware } from "./types/middleware.d.ts";

export const chainMiddlewares = <E = unknown[]>(
  middlewares: Middleware<{}, Context<E>>[],
  terminal: Handler<Context<E>>,
  index = 0,
): Handler<Context<E>> => {
  const middleware = middlewares[index];
  const handler = typeof middleware === "function" ? middleware : middleware?.handler;
  const next = handler ? chainMiddlewares<E>(middlewares, terminal, index + 1) : terminal;
  return async (req, ctx) => {
    try {
      const res = handler
        ? await handler(req, {
            ...ctx,
            fetchNext: (r, locals) => next(r, { ...ctx, locals: { ...ctx.locals, ...locals } }),
          })
        : await next(req, ctx);
      if (res instanceof Response) return res;
      throw new Error(
        `Function '${(handler || terminal).name || "<anonymous>"}' did not return a Response object`,
      );
    } catch (error) {
      return Object.assign(new Response("500 Internal Server Error", { status: 500 }), { error });
    }
  };
};
