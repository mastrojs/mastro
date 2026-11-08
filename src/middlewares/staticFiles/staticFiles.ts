import { Buffer } from "node:buffer";
import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import { extname } from "node:path";
import { contentTypeFromExt } from "./mediaTypes.ts";
import { findFiles } from "../../core/fs.ts";
import { urlPathToFilePath, type FilePath } from "../../core/fsHelpers.ts";
import type { Context, Middleware } from "../../middleware.ts";
import { staticCacheControlVal } from "../../core/routeHelpers.ts";

/**
 * Serve static files in routes folder (excluding *.client.ts, *.server.ts and *.server.js files)
 *
 * In production, we also look for files in the `generated` folder, which take precedence.
 */
export const staticFiles: Middleware = {
  name: "staticFiles",
  getStaticPaths: () =>
    findFiles(["routes/**/*", "routes/**/.*/**/*"])
      .then((paths) => paths.filter((p) => !reserved(p)).map((p) => p.slice(6))),
  handler: async (req, ctx) => await serveStaticFile(req, ctx) || ctx.fetchUpstream(req),
};

const serveStaticFile = async (req: Request, ctx: Context): Promise<Response | undefined> => {
  if (req.method === "GET" || req.method === "HEAD") {
    const { pathname } = new URL(req.url);
    const path = pathname.endsWith("/") ? (pathname + "index.html") : pathname;
    const tryPregen = generatedExists && ctx.mode === "server" && ctx.environment === "production";
    const pregenerated = tryPregen ? await tryServeFile(req, "generated" + path, reserved) : null;
    return pregenerated || await tryServeFile(req, "routes" + path, reserved);
  }
};

const generatedExists = (await fs.stat("generated", { throwIfNoEntry: false }))?.isDirectory();

export const tryServeFile = async (
  req: Request,
  path: string,
  reserved?: (path: FilePath) => boolean,
): Promise<Response | undefined> => {
  let decodedPath: FilePath;
  try {
    decodedPath = urlPathToFilePath(path);
  } catch {
    return newResponse(400);
  }
  if (reserved?.(decodedPath)) return;

  const res = await serveFile(req, decodedPath);

  if (res.status === 404 || res.status === 405) return;
  const cacheHeader = staticCacheControlVal(req);
  if (cacheHeader) res.headers.set("Cache-Control", cacheHeader);
  return res;
};

/**
 * Returns a `Response` from a file on the file system.
 *
 * Previously we did `import { serveFile } from "@std/http/file-server"`,
 * but [@std:http](https://jsr.io/@std/http) doesn't run on Node.js.
 * It also has a bunch of dependencies, so we use this vendored implementation everywhere.
 *
 * lightly adapted from:
 * https://github.com/denoland/std/blob/2258bf2628a97a03dece8d0235d910bfaf1f501d/http/file_server.ts
 * (MIT License)
 */
const serveFile = async (req: Request, filePath: FilePath): Promise<Response> => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return newResponse(405);
  }

  let fileInfo;
  try {
    fileInfo = await fs.stat(filePath);
  } catch (error: any) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return newResponse(404);
    } else {
      throw error;
    }
  }

  if (fileInfo.isDirectory()) {
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
  const contentTypeValue = contentTypeFromExt(extname(filePath).slice(1));
  if (contentTypeValue) {
    headers.set("Content-Type", contentTypeValue);
  }
  const fileSize = fileInfo.size;
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
  if (req.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  const file = await fs.open(filePath, "r");
  const stream = file.readableWebStream({ autoClose: true }) as ReadableStream;
  return new Response(stream, { status: 200, headers });
};

const reserved = (p: string) => /\.(client\.ts|server\.ts|server\.js)$/i.test(p);

const newResponse = (status: number) => new Response(`HTTP ${status}`, { status });

const encoder = new TextEncoder();
const eTag = async (fileInfo: Stats): Promise<string> => {
  const ab = await crypto.subtle.digest("SHA-256", encoder.encode(fileInfo.mtime.toJSON()));
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
  const tags = value.split(COMMA_REGEXP).map((tag) => tag.startsWith("W/") ? tag.slice(2) : tag);
  return !tags.includes(etag);
};
