import { contentType } from "@std/media-types";
import { Buffer } from "node:buffer";
import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import { extname } from "node:path";

/**
 * Returns a `Response` from a file on the file system.
 *
 * lightly adapted from:
 * https://github.com/denoland/std/blob/main/http/file_server.ts
 * (MIT License)
 */
export const serveFile = async (req: Request, filePath: string): Promise<Response> => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return newResponse(405);
  }

  let fileInfo;
  try {
    fileInfo = await fs.stat(filePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await req.body?.cancel();
      return newResponse(404);
    } else {
      throw error;
    }
  }

  if (fileInfo.isDirectory()) {
    await req.body?.cancel();
    return newResponse(404);
  }

  const headers = new Headers();

  if (fileInfo.mtime) {
    headers.set("Last-Modified", fileInfo.mtime.toUTCString());
  }
  const etag = fileInfo.mtime ? await eTag(fileInfo) : undefined;
  if (etag) {
    headers.set("ETag", etag);
  }

  const contentTypeValue = contentType(extname(filePath));
  if (contentTypeValue) {
    headers.set("Content-Type", contentTypeValue);
  }
  const fileSize = fileInfo.size;

  if (req.method === "HEAD") {
    headers.set("Content-Length", `${fileSize}`);
    return new Response(null, { status: 200, headers });
  }

  if (etag || fileInfo.mtime) {
    // If a `if-none-match` header is present and the value matches the tag or
    // if a `if-modified-since` header is present and the value is bigger than
    // the access timestamp value, then return 304
    const ifNoneMatchValue = req.headers.get("If-None-Match");
    const ifModifiedSinceValue = req.headers.get("If-Modified-Since");
    if (
      (!ifNoneMatch(ifNoneMatchValue, etag)) ||
      (ifNoneMatchValue === null &&
        fileInfo.mtime &&
        ifModifiedSinceValue &&
        fileInfo.mtime.getTime() <
          new Date(ifModifiedSinceValue).getTime() + 1000)
    ) {
      return new Response(null, { status: 304, headers });
    }
  }

  headers.set("Content-Length", `${fileSize}`);
  const stream = (await fs.open(filePath)).readableWebStream() as ReadableStream;
  return new Response(stream, { status: 200, headers });
};

const newResponse = (status: number, init?: ResponseInit) =>
  new Response(`HTTP ${status}`, { status, ...init });

const encoder = new TextEncoder();
const eTag = async (fileInfo: Stats): Promise<string> => {
  const ab = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(fileInfo.mtime.toJSON()),
  );
  const hash = Buffer.from(ab).toString("base64").substring(0, 27);
  return `"${fileInfo.size.toString(16)}-${hash}"`;
};

const STAR_REGEXP = /^\s*\*\s*$/;
const COMMA_REGEXP = /\s*,\s*/;
const ifNoneMatch = (value: string | null, etag: string | undefined): boolean => {
  if (!value || !etag) {
    return true;
  }
  if (STAR_REGEXP.test(value)) {
    return false;
  }
  etag = etag.startsWith("W/") ? etag.slice(2) : etag;
  const tags = value.split(COMMA_REGEXP).map((tag) =>
    tag.startsWith("W/") ? tag.slice(2) : tag
  );
  return !tags.includes(etag);
};
