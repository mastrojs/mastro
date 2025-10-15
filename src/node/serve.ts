/**
 * This module contains a basic version of a function like `Deno.serve`,
 * implemented using `node:http`.
 * @module
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Http2ServerResponse } from 'node:http2';

// deno-lint-ignore-file no-explicit-any

/**
 * Basic version of a function like `Deno.serve`,
 * implemented using `node:http`. To start a server:
 *
 * ```
 * import { serve } from "mastro/node";
 * import server from "mastro/server";
 * serve(server.fetch);
 * ```
 *
 * lightly adapted from:
 * https://github.com/withastro/astro/blob/db8f8becc9508fa4f292d45c14af92ba59c414d1/packages/astro/src/core/app/node.ts#L55
 * (MIT License)
 */
export const serve = (
  handler: (r: Request) => Response | Promise<Response>,
  opts?: { port?: number; },
): void => {
  const { port = 8000 } = opts || {};
  const server = createServer(async (req, res) => {
    const standardReq = createRequest(req);
    const standardRes = await handler(standardReq);
    await writeResponse(standardRes, res);
  });
  server.on('error', e => {
    console.error(e);
  });
  server.listen(port, () => console.log(`Listening on http://localhost:${port}`));
}

/**
 * Streams a web-standard Response into a NodeJS Server Response.
 */
const writeResponse = async (standardRes: Response, res: ServerResponse): Promise<void> => {
  const { status, headers, body, statusText } = standardRes;
  // HTTP/2 doesn't support statusMessage
  if (!(res instanceof Http2ServerResponse)) {
    res.statusMessage = statusText;
  }
  res.writeHead(status, Object.fromEntries(headers.entries()));
  if (!body) {
    res.end();
    return;
  }
  try {
    const reader = body.getReader();
    res.on('close', () => {
      // Cancelling the reader may reject not just because of
      // an error in the ReadableStream's cancel callback, but
      // also because of an error anywhere in the stream.
      reader.cancel().catch((err) => {
        console.error(
          `There was an uncaught error in the middle of the stream while rendering ${
            res.req.url}.`,
          err,
        );
      });
    });
    let result = await reader.read();
    while (!result.done) {
      res.write(result.value);
      result = await reader.read();
    }
    res.end();
    // the error will be logged by the "on end" callback above
  } catch (err) {
    res.write('Internal server error', () => {
      err instanceof Error ? res.destroy(err) : res.destroy();
    });
  }
}

/**
 * Converts a NodeJS IncomingMessage into a web standard Request.
 */
const createRequest = (req: IncomingMessage): Request => {
  const method = req.method || 'GET';
  const options: RequestInit = {
    method,
    headers: makeRequestHeaders(req),
    ...(method === 'HEAD' || method === 'GET' ? {} : asyncIterableToBodyProps(req)),
  };
  return new Request(getUrl(req), options);
}

const getUrl = (req: IncomingMessage): URL => {
  // Get the used protocol between the end client and first proxy.
  // NOTE: Some proxies append values with spaces and some do not.
  // We need to handle it here and parse the header correctly.
  // @example "https, http,http" => "http"
  const forwardedProtocol = getFirstValue(req.headers['x-forwarded-proto']);
  const providedProtocol = ('encrypted' in req.socket && req.socket.encrypted)
    ? 'https'
    : 'http';
  const protocol = forwardedProtocol ?? providedProtocol;

  // @example "example.com,www2.example.com" => "example.com"
  const forwardedHostname = getFirstValue(req.headers['x-forwarded-host']);
  const providedHostname = req.headers.host ?? req.headers[':authority'];
  const hostname = forwardedHostname ?? providedHostname;

  // @example "443,8080,80" => "443"
  const port = getFirstValue(req.headers['x-forwarded-port']);

  try {
    const hostnamePort = getHostnamePort(hostname, port);
    return new URL(`${protocol}://${hostnamePort}${req.url}`);
  } catch {
    // Fallback to the provided hostname and port
    const hostnamePort = getHostnamePort(providedHostname, port);
    return new URL(`${providedProtocol}://${hostnamePort}`);
  }
}

// Parses multiple header and returns first value if available.
const getFirstValue = (multiValueHeader?: string | string[]) =>
  multiValueHeader?.toString()?.split(',').map((e) => e.trim())?.[0];

const getHostnamePort = (
  hostname: string | string[] | undefined,
  port?: string,
): string => {
  const portInHostname = typeof hostname === 'string' && /:\d+$/.test(hostname);
  return portInHostname ? hostname : `${hostname}${port ? `:${port}` : ''}`;
}

const makeRequestHeaders = (req: IncomingMessage): Headers => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else {
      headers.append(name, value);
    }
  }
  return headers;
}

const asyncIterableToBodyProps = (iterable: AsyncIterable<any>): RequestInit => {
  return {
    // @ts-expect-error Undici accepts a non-standard async iterable for the body.
    body: iterable,
    // The duplex property is required when using a ReadableStream or async
    // iterable for the body. The type definitions do not include the duplex
    // property because they are not up-to-date.
    duplex: 'half',
  };
}
