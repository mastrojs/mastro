import type { Handler } from "./mastro.d.ts";

/**
 * Middleware allows you to intercept requests before they hit your routes, and modify responses
 * returned by upstream handlers.
 *
 * Often, calling a shared helper function (like [jsonRoute](https://github.com/mastrojs/api))
 * in your routes is simpler. However, middleware can be useful if you have lots of routes,
 * or want to ensure you don't forget calling the helper function accidentally (e.g. for auth).
 *
 * ## Execution order
 *
 * Multiple middlewares are executed in registration order. When a `Request` comes in, it first
 * hits the first middleware, which calls the next middleware in the chain, and so forth
 * – each middleware forming a layer in an onion, with your route handlers at the center.
 * On the way out, the `Response` is handed back, layer for layer, up the whole chain, with the
 * middlewares continuing their execution, in reverse order than on the way in.
 *
 * This is conceptually similar to middleware in other JS frameworks like Express or Hono.
 * However, Mastro's middleware API is explicitly modelled after a network proxy. Thinking
 * of your middleware as a network proxy may be easier than the onion call chain described above.
 *
 * If you use the `createApp` or `createFileRouterApp` factory from `@mastrojs/mastro/server`,
 * be aware that the middleware they set will run before the ones you add later (e.g. static files
 * will be served by the static file middleware without ever hitting your later middleware).
 * If that's a problem, use `new Mastro()` directly, import the default middlewares you need from
 * `@mastrojs/mastro/server`, and add them in the desired order.
 *
 * The simplest middleware, which doesn't do anything, is:
 *
 * ```ts
 * const identityMiddleware: Middleware = (req, ctx) =>
 *   ctx.fetchNext(req);
 * ```
 *
 * Or it can return early:

 * ```ts
 * const redirectMiddleware: Middleware = (req, ctx) => {
 *   const url = new URL(req.url);
 *   if (url.pathname === "/stories/") {
 *     return Response.redirect(new URL("/blog/", url));
 *   }
 *   return ctx.fetchNext(req);
 * }
 * ```
 *
 * Add it to your app with the `use` method:
 *
 * ```ts
 * export const app = createFileRouterApp()
 *   .use(identityMiddleware)
 *   .use(redirectMiddleware)
 * ```
 *
 * ## Error handling
 *
 * You don't need to wrap `ctx.fetchNext()` in `try...catch` – Mastro already does that for you
 * and returns a 500 Response with an `error` field that contains whatever value was thrown.
 * Be sure to check for `res.ok`, if your middleware should behave differently for 4xx or 5xx.
 *
 * ## Server and static site generation
 *
 * Middlewares are run on every route.
 * When doing static site generation, they are run when you generate the site. In that case,
 * returning 404 skips a page. Use the `Content-Disposition` HTTP header to override the output
 * filename (don't include the directory).
 *
 * When running a server, a middleware can be just a handler function (as seen above).
 * For static site generation, if you also need to provide `getStaticPaths` or `afterGenerate`,
 * use the object form (see [tsToJs](https://github.com/mastrojs/mastro/blob/main/libs/mastro/src/middlewares/tsToJs.ts) for an example).
 *
 * ## Locals
 *
 * Middleware can set or update locals, the types of which need to be declared with the `L` generic:
 *
 * ```ts
 * const authMiddleware: Middleware<{ user: User }> = async (req, ctx) => {
 *   const user = await loadUser(req.headers);
 *   return ctx.fetchNext(req, { user });
 * }
 *
 * const app = new Mastro()
 *   .use(authMiddleware)
 *   .get("/", (_req, ctx) => new Response(ctx.locals.user.name));
 * ```
 *
 * @template L Locals this middleware sets or updates, defaults to `{}`.
 * @template C Incoming base context, defaults to a Context with no declared locals.
 */
export type Middleware<L = {}, C extends { extras: unknown } = Context<unknown[], {}>> =
  | MiddlewareHandler<L, C>
  | {
      /** Name by which users can identify the middleware. */
      name: string;
      handler: MiddlewareHandler<L, C>;
      /** Called by the static site generator. */
      getStaticPaths?: (ctx: GeneratorCtxSimple<C>) => Promise<string[]> | string[];
      /** Called by the static site generator before generation starts. */
      beforeGenerate?: (ctx: GeneratorCtxSimple<C>) => void;
      /** Called by the static site generator after generation completes successfully. */
      afterGenerate?: (ctx: GeneratorCtxSimple<C>) => void;
    };

/** Object containing at least the `ctx.fetchNext` handler, and  `ctx.locals`. */
export type MiddlewareContext<C = Context, L = {}> = C & { fetchNext: FetchNext<L> };

type MiddlewareHandler<L = {}, C = Context> = Handler<MiddlewareContext<C, L>>;

interface BaseContext<E, L, P> {
  /** array of extra arguments to the root fetch handler that Mastro receives from the platform */
  readonly extras: Readonly<E>;
  /** ctx.locals is an object collecting variables set by middlewares */
  readonly locals: Readonly<L>;
  /** e.g. on the "/users/:userId" route, ctx.params.userId will be a string */
  readonly params: Readonly<P>;
}

/**
 * Context that both {@link Middleware} and route {@link Handler} receive as the second argument.
 *
 * A {@link GeneratorContext} when doing static site generation, otherwise a {@link ServerContext}.
 */
export type Context<
  E = unknown[],
  L = Record<string, unknown>,
  P = Record<string, string | undefined>,
> = GeneratorContext<E, L, P> | ServerContext<E, L, P>;

export interface GeneratorContext<E, L, P> extends BaseContext<E, L, P> {
  /** static site generation, or asset pregeneration */
  mode: "generator";
  /** Base URL for synthetic requests. Defaults to http://127.0.0.1. */
  baseUrl?: string;
  /** Only pregenerate marked routes, while still copying static files. */
  onlyPregenerate: boolean;
  /** Output directory. Defaults to generated. */
  outFolder?: string;
}

/** Generator lifecycle context, using the base context's extras without request-specific state. */
export type GeneratorCtxSimple<C extends { extras: unknown } = Context> = Omit<
  GeneratorContext<C["extras"], {}, {}>,
  "locals" | "params"
>;

export interface ServerContext<E, L, P> extends BaseContext<E, L, P> {
  mode: "server";
  environment: "development" | "production";
}

/**
 * Allow updates to a local only when the output variant preserves the existing type.
 * Without this restriction, it's hard to ensure the correct locals types in a middleware chain.
 */
export type CompatibleLocals<L, SetL> = (
  SetL extends Pick<L, keyof SetL & keyof L> ? true : false
) extends true
  ? unknown
  : never;

/**
 * Make sure `ctx.fetchNext(req, locals)` adheres to the generic `L` that the middleware declared.
 */
type FetchNext<in out L = {}> = <Arg extends L & object>(
  req: Request,
  ...args: {} extends L ? [locals?: NoExtraKeys<L, Arg>] : [locals: NoExtraKeys<L, Arg>]
) => Promise<Response> | Response;

/* Reject Arg object if it tries to set more keys than the middleware declared in L. */
type NoExtraKeys<L, Arg> = Arg &
  Record<Exclude<Arg extends unknown ? keyof Arg : never, keyof L>, never>;
