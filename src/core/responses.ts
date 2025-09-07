import { type Html, renderToStream, renderToString } from "./html.ts";

/**
 * Create a standard Response object with `Content-Type: text/html` from a string
 * or `AsyncIterable<string>` (in which case it will stream it).
 */
export const htmlResponse = (
  body: string | AsyncIterable<string>,
  status = 200,
  headers?: HeadersInit,
): Response => {
  let payload;
  if (isAsyncIterable(body)) {
    const encoder = new TextEncoder();
    payload = ReadableStream.from(mapIterable(body, (chunk) => encoder.encode(chunk)));
  } else {
    payload = body;
  }
  return new Response(
    payload,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...headers,
      },
    },
  );
};

/**
 * Create a standard Response object from an `Html` node through serializing to a `string` first.
 *
 * TODO: benchmark this against `htmlToStreamingResponse`
 */
export const htmlToResponse = async (node: Html): Promise<Response> =>
  htmlResponse(await renderToString(node));

/**
 * Create a standard Response object from an `Html` node through a `ReadableStream`.
 *
 * TODO: benchmark this against `htmlToResponse`
 */
export const htmlToStreamingResponse = (node: Html): Response =>
  htmlResponse(renderToStream(node));

/**
 * Create a standard Response object with `Content-Type: application/json`.
 */
export const jsonResponse = (
  body: object,
  status = 200,
  headers?: HeadersInit,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

/**
 * Maps over an `AsyncIterable`, just like you'd map over an array.
 */
async function* mapIterable<T, R>(
  iter: AsyncIterable<T>,
  callback: (val: T, index: number) => R,
): AsyncIterable<R> {
  let i = 0;
  for await (const val of iter) {
    yield callback(val, i++);
  }
}

// deno-lint-ignore no-explicit-any
const isAsyncIterable = <T>(val: any): val is AsyncIterable<T> =>
  val && typeof val[Symbol.asyncIterator] === "function";
