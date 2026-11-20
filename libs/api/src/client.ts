/**
 * `@mastrojs/api/client` contains functions for the client of the API.
 * @module
 */

// deno-lint-ignore-file no-explicit-any
import { Err, Ok, type Result } from "@mastrojs/result";
import type { JsonRoute } from "./server.ts";

/** HTTP Methods */
export type Method = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";

/** Fetch options with timeout */
export type RequestOpts = RequestInit & { timeout?: number };

/**
 * String that will be in `res.error` in case of a fetch timeout.
 */
export const timeoutError = "timeoutError";

/**
 * Thin wrapper around `fetch` that returns a Result instead of throwing.
 */
export const fetchJson = async <T>(
  method: Method,
  url: URL | string,
  data?: unknown,
  options: RequestOpts = {},
): Promise<Result<T>> => {
  const { headers, timeout = 90000, ...restOptions } = options;
  const controller = new AbortController();
  const abortTimeout = setTimeout(() => controller.abort(), timeout);
  const body = data === undefined
    ? undefined
    : (data instanceof File ? data : JSON.stringify(data));

  const fetchOpts: RequestInit = {
    method,
    headers: {
      "Content-Type": data instanceof File ? data.type : "application/json",
      ...headers,
    },
    body,
    signal: controller.signal,
    ...restOptions,
  };

  let response;
  let jsonData;
  let error: any;
  try {
    response = await fetch(url, fetchOpts);
    jsonData = await response.json();
  } catch (e) {
    error = e;
  } finally {
    clearTimeout(abortTimeout);
  }

  if (!response || !response.ok || error) {
    let statusCode: number | undefined;
    let errString: string;
    if (error?.name === "AbortError") {
      errString = timeoutError;
    } else if (response?.status === 204) {
      // No Content
      return Ok(null as any);
    } else if (response?.status === 200) {
      // response.json() can throw if a request is interrupted,
      // but headers (including status=200) could already have been received.
      errString = error?.message || error?.toString() || "Unknown fetch error";
    } else {
      statusCode = response?.status;
      errString = typeof jsonData?.error === "string"
        ? jsonData.error
        : (typeof jsonData?.error?.message === "string"
          ? jsonData.error.message
          : `Failed to ${method} ${url}`);
    }
    return Err(errString, statusCode, jsonData?.message, jsonData);
  } else {
    return Ok(jsonData);
  }
};

/**
 * Typesafe version of `fetchJson` that accepts the type of a server route.
 *
 * Example usage:
 * ```ts
 * const res = await fetchApi<SearchPost>("POST", "/search", { q: "needle" });
 * ```
 */
export function fetchApi<R extends JsonRoute<any, "GET" | "DELETE" | "HEAD" | "OPTIONS">>(
  method: R["__method"],
  path: R["__path"],
  data?: R["__reqBody"],
  queryParams?: R["__queryParams"],
  opts?: RequestOpts,
): Promise<Result<R["__resBody"]>>;
export function fetchApi<R extends JsonRoute<any, "PATCH" | "POST" | "PUT">>(
  method: R["__method"],
  path: R["__path"],
  data: R["__reqBody"],
  queryParams?: R["__queryParams"],
  opts?: RequestOpts,
): Promise<Result<R["__resBody"]>>;
export function fetchApi(method: any, path: any, data: any, queryParams: any, opts: any) {
  const url = queryParams ? `${path}?${new URLSearchParams(queryParams).toString()}` : path;
  return fetchJson(method, url, data, opts);
}
