import * as v from '@valibot/valibot';

import { getParams } from "./core/router.ts";
import { jsonResponse } from "./core/responses.ts";
import type { Method } from "./api.client.ts";

/**
 * This is the standard `(req: Request) => Response type`, along with a few phantom types
 * (aka branded types), which we use for type-checking in `fetchApi`.
 */
// deno-lint-ignore no-explicit-any
export type JsonRoute<B=any, M extends Method = any, P=any, Q=any, R=any, U extends string = any> =
  ((req: Request) => Response | Promise<Response>) & {
  __method: M;
  __params: P;
  __path: U;
  __queryParams: Q;
  __reqBody: v.InferOutput<B>;
  __resBody: R;
}

/**
 * Constructs a JSON API route, handling request input validation and JSON serialization.
 * The returned type contains also all route information for the `fetchApi<JsonRoute>` client function.
 *
 * Example usage:
 *
 * ```
 * export type ChatPost = typeof POST
 * export const POST = jsonRoute(
 *   {
 *     method: 'POST',
 *     path: '' as `${string}.json`,
 *     params: { chatId: 'string' },
 *     queryParams: { q: '' as string | undefined },
 *     reqBodySchema: schema,
 *   },
 *   async ({ body, params }) => {
 *     return { text: 'hello world' }
 *   }
 * )
 * ```
 *
 * TODO: we should use valibot to specify the params and queryParams
 */
export const jsonRoute = <
    M extends Method,
    P extends Record<string, string | undefined>,
    Q extends Record<string, string | undefined>,
    R extends object,
    U extends string,
    B=undefined,
  >(
    opts: {
      method: M;
      params?: P;
      path: U;
      queryParams?: Q;
      reqBodySchema?: v.InferOutput<B>;
    },
    handler: (
      context: {
        body: B;
        queryParams: Q;
      }
    ) => R | Promise<R>,
  ): JsonRoute<B, M, P, Q, R, U> => (
    async (req) => {
      const url = new URL(req.url)
      const params = getParams(req.url)

      for (const key in opts.params) {
        if (!params[key]) {
          return jsonErr(`Param '${key}' missing`, 401);
        }
      }

      const queryParams = opts.queryParams ? Object.fromEntries(url.searchParams) : undefined
      for (const key in opts.queryParams) {
        if (opts.queryParams[key] === 'string' && !queryParams?.[key]) {
          return jsonErr(`Mandatory QueryParam '${key}' missing`, 401);
        }
      }

      let body
      if (opts.reqBodySchema) {
        try {
          const data = await req.json()
          body = v.parse(opts.reqBodySchema, data);
        } catch (e) {
          const error = e instanceof v.ValiError
            ? 'Zod schema validation failed: ' + JSON.stringify(e.issues)
            : (e instanceof Error ? e.message : 'validate failed')
          return jsonErr(error, 400);
        }
      }

      let res
      try {
        res = await handler({ req, body, queryParams })
      } catch (e) {
        return jsonErr(e, 500);
      }

      const status = 'status' in res ? res.status : undefined;
      return jsonResponse(res, typeof status === "number" ? status : 200)
    }
  ) as JsonRoute<B, M, P, Q, R, U>

const jsonErr = (e: unknown, status: number) => {
  const error = e instanceof Error ? e.message : e?.toString();
  return jsonResponse({ error, status }, status);
}
