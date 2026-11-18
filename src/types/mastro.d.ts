import type { HttpMethod } from "../mastro.ts";
import type { Context, MiddlewareContext } from "./middleware.d.ts";

/** A route pathname starts with a slash. */
export type Pathname = `/${string}`;

/**
 * A route or middleware handler. It receives a standard Request
 * (and a {@link Context} or {@link MiddlewareContext} as a second argument).
 *
 * ```ts
 * import { type Handler } from "@mastrojs/mastro";
 *
 * export const GET: Handler = (req, ctx) =>
 *   new Response(`Hello ${ctx.params.name ?? "world"}`);
 * ```
 */
export type Handler<C = Context> = (req: Request, ctx: C) => Promise<Response> | Response;

/**
 * A Mastro Route
 */
export interface Route<C = Context> {
  /**
   * Name of the route for error messages etc.
   * For file-based routes the `filePath`, e.g. `routes/index.server.ts`
   */
  name: string;
  /** Fetch handler */
  handler: Handler<C>;
  /** HTTP method, or "all" if the route should match any HTTP method. */
  method: "all" | HttpMethod;
  /** `URLPattern` with `pathname` set */
  pattern: URLPattern;
  /** Called by the static site generator. */
  getStaticPaths?: () => Promise<string[]> | string[];
  /** Before starting your server, you can run `mastro generate --only-pregenerate` to
   * only pregenerate routes which have this field set. */
  pregenerate?: true;
}

export type RouteHandler<E, L, P extends Pathname> =
  | Handler<Context<E, L, RouteParams<P>>>
  | {
      handler: Handler<Context<E, L, RouteParams<P>>>;
      getStaticPaths?: () => Promise<string[]> | string[];
      pregenerate?: true;
    };

/** Expand merged locals into an object shape for editor hovers. */
export type Simplify<T> = { [Key in keyof T]: T[Key] } & {};

type ParamNames<P> = string extends P
  ? string
  : P extends `${string}${"(" | "{" | "\\"}${string}`
    ? string
    : P extends `${infer Segment}/${infer Rest}`
      ? ParamNames<Segment> | ParamNames<Rest>
      : P extends `${string}:${infer Name}`
        ? Name extends `${string}${":" | "-" | "@"}${string}`
          ? string
          : Name extends `${infer Param}.${string}`
            ? Param
            : Name
        : P extends `${string}*${string}`
          ? string
          : never;

/** e.g. `RouteParams<"/users/:userId">` is the type `{ userId: string }`.
 * We don't cover full URLPattern syntax, but do support `.suffix`, `?`, `+` and `*` modifiers.
 * `string` signals that we need the Record fallback.
 */
export type RouteParams<P extends Pathname> =
  string extends ParamNames<P>
    ? Record<string, string | undefined>
    : {
        [
          K in ParamNames<P> as K extends `${infer Name}${"?" | "+" | "*"}` ? Name : K
        ]: K extends `${string}${"?" | "*"}` ? string | undefined : string;
      };
