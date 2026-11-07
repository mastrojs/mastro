/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by the [static site generator on the CLI](https://mastrojs.github.io/docs/install-setup/#generate-a-static-site).
 * @module
 */

import { posix } from "node:path";

import { urlPathToFilePath } from "./core/fs.ts";
import type { Handler, Mastro, Route } from "./core/mastro.ts";
import { fetchUpstream, routeHandler } from "./core/routeHelpers.ts";
import type { Context, GeneratorContext, GeneratorContextSimple } from "./middleware.ts";
import { chainMiddlewares } from "./middleware.ts";
import { middlewares as defaultMiddlewares } from "./servers/server.ts";

/**
 * Config options for `generate`
 */
export interface GenerateOpts {
  /**
   * Base URL for the synthetic requests sent by the generator. Default is http://127.0.0.1
   * to make them distinguishable from requests from localhost (see `isDevServer`).
   */
  baseUrl?: string;
  /**
   * Name of output folder that will be created. Default is `generated`.
   */
  outFolder?: string;
  /**
   * Only pregenerate routes with `export const pregenerate = true`,
   * but still copy over static files (in case you want to serve those via CDN).
   * Useful as a build step for servers.
   */
  onlyPregenerate?: boolean;
}

/**
 * Generate all pages for the static site and write them to disk.
 *
 * Can not be used in the VSCode extension.
 */
export const generate = async (app: Mastro, opts: GenerateOpts = {}): Promise<boolean> => {
  const fs = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  const { baseUrl = "http://127.0.0.1", outFolder = "generated", onlyPregenerate = false } = opts;
  const resetP = fs.rm(outFolder, { force: true, recursive: true }).then(() => fs.mkdir(outFolder));

  const middlewares = [...app.middlewares];
  if (!middlewares.some((m) => m.name === "staticFiles")) {
    // when we get passed an app for Cloudflare Workers or similar, we add staticFiles etc.
    console.info("Did not find a staticFiles middleware, adding defaultMiddlewares.\n");
    middlewares.unshift(...defaultMiddlewares);
  }
  middlewares.push(createRouter(await app.getRoutes()));

  const handler = chainMiddlewares(middlewares);
  const ctx: GeneratorContextSimple = { mode: "generator", onlyPregenerate, extra: [] };
  const ctxWithFetchUpstream: GeneratorContext = { ...ctx, fetchUpstream };
  await resetP;

  let completeSuccess = true;
  for (const m of middlewares) {
    if ("getStaticPaths" in m && m.getStaticPaths) {
      for (const path of validateStaticPaths(m.name, await m.getStaticPaths(ctx))) {
        // TODO: parallelize without opening too many file handles at once
        const url = new URL(baseUrl + path);
        const { response, outFilePath } = await generatePage(handler, url, ctxWithFetchUpstream);
        if (response.ok) {
          const outPath = join(outFolder, outFilePath);
          await fs.mkdir(dirname(outPath), { recursive: true });
          if (response.body) {
            await writeFile(outPath, response.body);
          } else {
            console.warn(`\nWARNING: ${path} returned no body (HTTP ${response.status})\n.`);
          }
        } else if (response.status !== 404) {
          completeSuccess = false;
        }
      }
    }
  }
  if (completeSuccess) {
    await Promise.all(
      middlewares.map((m) => ("afterGenerate" in m ? m.afterGenerate?.(ctx) : null)),
    );
    console.info(`Generated static site and wrote to \`${outFolder}\` folder.`);
  }
  return completeSuccess;
};

const generatePage = async (handler: Handler<[Context]>, url: URL, ctx: Context) => {
  const req = new Request(url);
  const response = await handler(req, ctx);
  const filename = parseContentDisposition(response.headers.get("Content-Disposition"));
  const directory = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1);
  const path = filename ? directory + filename : url.pathname;
  const outFilePath = urlPathToFilePath(path.endsWith("/") ? `${path}index.html` : path);
  return { response, outFilePath };
};

const parseContentDisposition = (val: string | null) => val?.match(/filename="?([^";]+)"?/i)?.[1];

const writeFile = async (path: string, data: ReadableStream<Uint8Array> | Buffer) => {
  const { createWriteStream } = await import("node:fs");
  const { Readable } = await import("node:stream");
  return new Promise<void>((resolve, reject) =>
    Readable.fromWeb(data as any)
      .pipe(createWriteStream(path))
      .on("finish", resolve)
      .on("error", reject),
  );
};

const createRouter = (routes: Route[]) => ({
  name: "router",
  handler: routeHandler(routes),
  getStaticPaths: async (ctx: GeneratorContextSimple) => {
    const rs = ctx.onlyPregenerate ? routes.filter((r) => r.pregenerate) : routes;
    const paths = rs.filter((r) => r.method === "GET" || r.method === "all").map(async (r) => {
      if (typeof r.getStaticPaths === "function") return r.getStaticPaths();
      if (hasRouteParams.test(r.pattern.pathname)) throw Error(r.name + errMsg);
      return r.pattern.pathname.replace(/\\(.)/g, "$1"); // unescape URLPattern syntax
    }).reverse();
    return (await Promise.all(paths)).flat();
  },
});
// URLPattern parameters, wildcards, and groups require concrete paths:
const hasRouteParams = /(?<!\\)[:*{(]/
const errMsg = " should provide a getStaticPaths function returning an array of strings.";

const validateStaticPaths = (name: string, paths: string[]) => {
  const prefix = `${name}"#getStaticPaths`;
  const notStringMsg = " must return an array of strings";
  if (!Array.isArray(paths)) throw Error(prefix + notStringMsg);
  for (const path of paths) {
    if (typeof path !== "string") throw Error(prefix + notStringMsg);
    if (path[0] !== "/") throw Error(prefix + ": paths must start with a slash (/)");
    if (path.includes("#") || path.includes("?") || path.includes("\\")) {
      throw Error(`${prefix} must return encoded URL paths. Use encodeURIComponent.`);
    }
    if (!path.endsWith("/") && !posix.extname(path) && !path.startsWith("/.well-known/")) {
      console.warn(`\nWARNING: ${name} has path ${path} without file extension.
  Consider renaming route to e.g. ${name.replace(".server", ".html.server")}\n`);
    }
  }
  return paths;
};
