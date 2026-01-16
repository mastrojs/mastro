import { type Html, renderToStream } from "./html.ts";

/**
 * Take the path of a URL and extract its parameters.
 * See the [Mastro Guide](https://mastrojs.github.io/guide/static-blog-from-markdown-files/#detail-pages).
 *
 * For example in `routes/[slug].server.ts`:
 *
 * ```ts
 * import { getParams, html, htmlToResponse } from "@mastrojs/mastro";
 *
 * export const GET = (req) => {
 *   const { slug } = getParams(req);
 *   return htmlToResponse(html`Hello ${slug}`);
 * }
 */
export const getParams = (req: Request): Record<string, string | undefined> =>
  (req as any)._params || {};

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
 * Returns the GitHub Pages base path (or an empty string).
 *
 * If you're hosting your website with GitHub Pages on a sub-directory
 * (e.g. `https://my-name.github.io/my-repo` instead of `https://my-name.github.io`
 * or instead of a custom domain), then you need to prefix all absolute links
 * that start with a slash with you base-path (`/my-repo` in this case),
 * which is what this function returns when run on GitHub Actions.
 *
 * For example in your `Layout.ts` file:
 *
 * ```ts
 * import { ghPagesBasePath, html } from "@mastrojs/mastro";
 * export const basePath = ghPagesBasePath(); // export for use in other modules
 * export const GET = () =>
 *   html`
 *     <html>
 *       <head>
 *         <link href=${basePath + "/styles.css"}>
 *   `;
 * ```
 *
 * btw. if you're not on GitHub Pages, but still hosting in a sub-directory, you can
 * change the `generate` command in `deno.json` to `BASEPATH='/my-path' deno task generate`,
 * and use that like:
 *
 * ```ts
 * export const basePath = process.env.BASEPATH || "";  // export for use in other modules
 * export const GET = () =>
 *   html`
 *     <html>
 *       <head>
 *         <link href=${basePath + "/styles.css"}>
 *   `;
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

const isAsyncIterable = <T>(val: any): val is AsyncIterable<T> =>
  val && typeof val[Symbol.asyncIterator] === "function";
