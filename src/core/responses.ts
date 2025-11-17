import { type Html, renderToStream } from "./html.ts";

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
    payload = toReadableStream(body);
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
 * Create a standard Response object from an `Html` node.
 */
export const htmlToResponse = (node: Html): Response =>
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

const toReadableStream = (iterable: AsyncIterable<string>) => {
  // TODO: check back when and if something like the following works and is more performant:
  // return ReadableStream.from(iterable.map(str => encoder.encode(str)));

  const encoder = new TextEncoder();
  const iterator = iterable[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(encoder.encode(value));
        }
      } catch (e) {
        console.error(e);
        controller.enqueue(encoder.encode(` ${e}`));

        // The idea here is to return a malformed chunk, so CDNs don't cache the response
        // TODO: test whether this actually works in today's CDNs
        // see https://stackoverflow.com/questions/15305203/
        // and https://github.com/withastro/astro/pull/12333
        controller.enqueue(new Uint8Array([0]));
      }
    },
    cancel() {
      iterator.return?.();
    },
  });
}

/**
 * If you're hosting your website on the root (e.g `https://my-name.github.io`), you
 * won't need this. But if you're hosting it in a sub-directory, which is common with GitHub Pages:
 * (e.g. `https://my-name.github.io/my-repo`), then you need to prefix all absolute links that
 * start with a slash with a `basePath`.
 *
 * For example in your `Layout.ts` file:
 *
 * ```ts
 * import { ghPagesBasePath, html } from "@mastrojs/mastro";
 *
 * export const basePath = ghPagesBasePath();
 * export const GET = () =>
 *   html`<link href=${basePath + "/styles.css"}>`
 * ```
 *
 * The above `basePath` variable will contain "/my-repo" when run on GitHub Actions.
 *
 * If you're not on GitHub Pages, but still hosting in a sub-directory, you can
 * change the `generate` command in `deno.json` to `BASEPATH='/my-path' deno task generate`,
 * and use that like:
 *
 * ```ts
 * export const basePath = process.env.BASEPATH || "";
 * ```
 */
export const ghPagesBasePath = (): string => {
  if (typeof window === "undefined") {
    // see https://docs.github.com/en/actions/reference/workflows-and-actions/variables
    const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
    if (repo && !repo.endsWith(".github.io")) {
      return "/" + repo;
    }
  }
  return "";
};

// deno-lint-ignore no-explicit-any
const isAsyncIterable = <T>(val: any): val is AsyncIterable<T> =>
  val && typeof val[Symbol.asyncIterator] === "function";
