/**
 * `@mastrojs/api/server` contains functions for the API server.
 * @module
 */

// deno-lint-ignore-file no-explicit-any
import { type Context, type Handler, jsonResponse } from "@mastrojs/mastro";
import { Err, type Result } from "@mastrojs/result";

import type { Method } from "./client.ts";
import type { StandardSchemaV1 } from "./standard-schema.ts";

/**
 * Constructs a JSON API route, handling request input validation and JSON serialization.
 * The returned type contains also all route information for the `fetchApi<JsonRoute>` client function.
 *
 * Example usage: place the following into `routes/todo/[id].server.ts`
 *
 * ```ts
 * import { Err, Ok } from "@mastrojs/result";
 * import { jsonRoute } from "@mastrojs/api/server";
 * import { boolean, object, optional, string } from "../../validate.js";
 *
 * export type TodoPatch = typeof PATCH;
 * export const { PATCH } = jsonRoute({
 *   method: "PATCH",
 *   path: `/todo/${"id" as string}`,
 *   params: object({ id: string }),
 *   body: object({ done: optional(boolean), title: optional(string) }),
 * }, async ({ body, params }) => {
 *   const { done, title } = body;
 *   const { id } = params;
 *   const updatedTodo = await db.updateTodo(id, { done, title });
 *   return updatedTodo ? Ok(updatedTodo) : Err("Not found", 404);
 * });
 * ```
 */
export const jsonRoute = <
  M extends Method,
  P extends Record<string, number | string | undefined>,
  Q extends Record<string, number | string | undefined>,
  R extends object,
  U extends string,
  B = undefined,
>(
  opts: {
    /** HTTP method */
    method: M;
    /** Path as a string literal. Its value is not used,
     * but its type is used to verify the client. Example: `` path: `/users/${"id" as string}` `` */
    path: U;
    /** Schema for URL path parameters */
    params?: StandardSchemaV1<unknown, P>;
    /** Schema for URL query parameters */
    query?: StandardSchemaV1<unknown, Q>;
    /** Schema for JSON request body */
    body?: StandardSchemaV1<unknown, B>;
  },
  /**
   * Callback that's called with the validated request parameters and should return a `Result`.
   */
  handler: (
    context: { body: B; params: P; query: Q; req: Request },
  ) => Result<R> | Promise<Result<R>>,
): { [method in M]: JsonRoute<B, M, P, Q, R, U> } => ({
  [opts.method]: async (req: Request, ctx: Context) => {
    const url = new URL(req.url);
    const params = ctx.params;

    const paramsRes = await opts.params?.["~standard"].validate(params);
    if (paramsRes?.issues) {
      return response(Err("URL path failed to validate", 401, undefined, paramsRes));
    }

    const query = Object.fromEntries(url.searchParams);
    const queryRes = await opts.query?.["~standard"].validate(query);
    if (queryRes?.issues) {
      return response(Err(`queryParams failed to validate`, 401, undefined, queryRes));
    }

    let body;
    if (opts.body) {
      let data: unknown;
      try {
        data = await req.json();
      } catch (e) {
        return response(Err(e instanceof Error ? e.message : "invalid JSON", 400));
      }
      const result = await opts.body["~standard"].validate(data);
      if (result.issues) {
        return response(Err("Body failed to validate", 400, undefined, result));
      } else {
        body = result.value;
      }
    }

    const res = await handler({ body, params, query, req } as any);

    return response(res);
  },
} as { [method in M]: JsonRoute<B, M, P, Q, R, U> });

/**
 * This is a Mastro handler receiving `(req, ctx)`, along with a few phantom types
 * (aka branded types), which we use for type-checking in `fetchApi`.
 */
export type JsonRoute<
  B = any,
  M extends Method = any,
  P = any,
  Q = any,
  R = any,
  U extends string = any,
> = Handler<Context> & {
  __method: M;
  __params: P;
  __path: U;
  __queryParams: Q;
  __reqBody: B;
  __resBody: R;
};

const response = (res: Result<object>): Response =>
  res.ok
    ? jsonResponse(res.val)
    // JSON.stringify({ cause: Error("no") }) gives {"cause":{}} so we're not leaking stack traces:
    : jsonResponse(res, res.statusCode || 500);
