import { isDevServer, type Handler } from "../server/common.ts";

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
export type Middleware = MiddlewareHandler | {
  /** Name by which users can filter the middlewares.  */
  name: string;
  /** Fetch handler */
  handler: MiddlewareHandler,
  /** Called by the static site generator. */
  getStaticPaths?: () => Promise<string[]> | string[];
  /** Called by the static site generator when its done. */
  afterGenerate?: (ctx: {mode: "generator"; onlyPregenerate: boolean; }) => void;
}

export type MiddlewareHandler = (req: Request, ctx: Context) => Promise<Response> | Response;

/**
 * Create fetch handler
 */
export const createHandler = (middlewares: Middleware[]): Handler => {
  const handler = chainMiddlewares(middlewares);
  return async req => {
    const isDev = isDevServer(new URL(req.url));
    const environment = isDev ? "development" : "production";
    try {
      return await handler(req, { mode: "server", environment, fetchUpstream });
    } catch (e: any) {
      return new Response(
        `500 Internal Server Error\n\n${isDev ? (e.stack || e) : e.name || "Unknown error"}`,
        { status: 500 },
      );
    }
  };
}

const fetchUpstream = () => new Response("Not found", { status: 404 });

export type Context = {
  fetchUpstream: Handler;
  mode: "generator";
  onlyPregenerate: boolean;
} | {
  fetchUpstream: Handler;
  mode: "server";
  environment: "development" | "production";
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
