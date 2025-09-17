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
    payload = ReadableStream.from(toByteStream(body));
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

async function* toByteStream(iter: AsyncIterable<string>): AsyncIterable<Uint8Array> {
  const encoder = new TextEncoder();
  try {
    for await (const val of iter) {
      yield encoder.encode(val);
    }
  } catch (e) {
    yield encoder.encode(` ${e}`);

    // The idea here is to return a malformed chunk, so CDNs don't cache it
    // TODO: test whether this actually works in today's CDNs
    // see https://stackoverflow.com/questions/15305203/
    // and https://github.com/withastro/astro/pull/12333
    yield new Uint8Array([0]);
  }
}

// deno-lint-ignore no-explicit-any
const isAsyncIterable = <T>(val: any): val is AsyncIterable<T> =>
  val && typeof val[Symbol.asyncIterator] === "function";
