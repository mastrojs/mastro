import { type Html, renderToString } from './html.ts'

export const htmlResponse = (
  body: string | AsyncIterable<string>,
  status = 200,
  headers?: HeadersInit,
): Response => {
  const encoder = new TextEncoder()
  const payload = isAsyncIterable(body)
    ? ReadableStream.from(mapIterable(body, chunk => encoder.encode(chunk)))
    : body
  return new Response(
    payload,
    {
      status,
      headers: {
        'Content-Type': 'text/html',
        ...headers,
      },
    })
}

export const htmlToResponse = async (node: Html): Promise<Response> =>
  htmlResponse(await renderToString(node))

export const jsResponse = (body: string, status = 200, headers?: HeadersInit): Response =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/javascript',
      ...headers,
    },
  })

export const jsonResponse = (body: object, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })


/**
 * Maps over an `AsyncIterable`, just like you'd map over an array.
 */
async function * mapIterable<T, R> (
  iter: AsyncIterable<T>,
  callback: (val: T, index: number) => R,
): AsyncIterable<R> {
  let i = 0
  for await (const val of iter) {
    yield callback(val, i++)
  }
}

// deno-lint-ignore no-explicit-any
const isAsyncIterable = <T>(val: any): val is AsyncIterable<T> =>
  val && typeof val[Symbol.asyncIterator] === 'function'
