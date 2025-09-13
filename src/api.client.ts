// deno-lint-ignore-file no-explicit-any
import type { JsonRoute } from "./api.ts";

export type Method = 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

export type Opts = RequestInit & { timeout?: number }

export const timeoutError = 'Request timed out'

export const makeRequest = async <T>(
  method: Method,
  url: URL | string,
  data: unknown,
  options: Opts = {},
): Promise<T | { error: string; status?: number; }> => {
  const { headers, timeout = 90000, ...restOptions } = options
  const controller = new AbortController()
  const abortTimeout = setTimeout(() => controller.abort(), timeout)
  const body = data === undefined
    ? undefined
    : (data instanceof File ? data : JSON.stringify(data))

  const fetchOpts: RequestInit = {
    method,
    headers: { 'Content-Type': data instanceof File ? data.type : 'application/json', ...(headers || {}) },
    body,
    signal: controller.signal,
    ...restOptions,
  }

  let response
  let json
  let err
  try {
    response = await fetch(url.toString(), fetchOpts)
    json = await response.json()
  } catch (e: any) {
    err = e
  } finally {
    clearTimeout(abortTimeout)
  }

  if (!response || !response.ok || err) {
    if (json === null || typeof json !== "object") {
      json = {};
    }

    const status = response?.status;
    const timedOut = err?.name === 'AbortError'
    if (timedOut) {
      json.error = timeoutError
    } else if (status === 200) {
      // response.json() may throw when a request is interrupted,
      // but headers (including status=200) could already have been received.
      json.error = err?.message || err?.toString() || 'Unknown fetch error';
    } else {
      json.status = status;
      if (typeof json?.error !== 'string' && status !== 204) {
        json.error = `Failed to ${method} ${url}`;
      }
    }
  }

  return json;
}

export function fetchApi<R extends JsonRoute<any, 'GET' | 'DELETE' | 'HEAD' | 'OPTIONS'>>(
  method: R['__method'], path: R['__path'], data?: R['__reqBody'], queryParams?: R['__queryParams'], opts?: Opts
): Promise<R['__resBody']>
export function fetchApi<R extends JsonRoute<any, 'PATCH' | 'POST' | 'PUT'>>(
  method: R['__method'], path: R['__path'], data: R['__reqBody'], queryParams?: R['__queryParams'], opts?: Opts
): Promise<R['__resBody']>
export function fetchApi (method: any, path: any, data: any, queryParams: any, opts: any) {
  const url = queryParams ? `${path}?${new URLSearchParams(queryParams).toString()}` : path
  return makeRequest(method, url, data, opts)
}
