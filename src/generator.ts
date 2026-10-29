/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by the [static site generator on the CLI](https://mastrojs.github.io/docs/install-setup/#generate-a-static-site).
 * @module
 */

import type { Mastro, Route } from "./core/mastro.ts";
import { chainMiddlewares, type Context, type GeneratorContext, type GeneratorContextBase, type MiddlewareHandler } from "./middleware.ts";
import { middlewares } from "./servers/server.ts";
import { fetchUpstream, routeHandler } from "./core/routeHelpers.ts";
import { extname } from "node:path";

/**
 * Config options for `generate`
 */
export interface GenerateOpts {
  /**
   * Files in this folder get hashed output names. Default is `_assets`, empty string to disable.
   */
  assetsFolder?: string;
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
  const { dirname } = await import("node:path");
  const { fileURLToPath, pathToFileURL } = await import("node:url");
  const {
    baseUrl = "http://127.0.0.1",
    outFolder = "generated",
    onlyPregenerate = false,
  } = opts;
  const resetP = fs.rm(outFolder, { force: true, recursive: true }).then(() => fs.mkdir(outFolder));

  const { middlewares } = app;
  if (!middlewares.some(m => m.name === "staticFiles")) {
    // when we get passed an app for Cloudflare Workers or similar, we add staticFiles etc.
    console.info("Did not find a staticFiles middleware, adding defaultMiddlewares.\n");
    middlewares.unshift(...middlewares);
  }
  middlewares.push(createRouter(await app.getRoutes()));

  const handler = chainMiddlewares(middlewares);
  const ctx: GeneratorContext = { mode: "generator", onlyPregenerate, fetchUpstream };
  await resetP;

  let completeSuccess = true;
  for (const m of middlewares) {
    if ("getStaticPaths" in m && m.getStaticPaths) {
      for (const path of await m.getStaticPaths(ctx)) {
        // TODO: parallelize without opening too many file handles at once
        const file = await generatePage(handler, new URL(baseUrl + path), ctx);
        if (file === false) {
          completeSuccess = false;
        } else if (file) {
          const outPath = outFolder + file.outFilePath; // call pathToFileURL here?
          await fs.mkdir(dirname(outPath), { recursive: true });
          const { body } = file.response;
          if (body) {
            await writeFile(outPath, body);
          }
        }
      }
    }
  }
  if (completeSuccess) {
    await Promise.all(middlewares.map((m) => "afterGenerate" in m ? m.afterGenerate?.(ctx) : null));
    console.info(`Generated static site and wrote to ${outFolder} folder.`);
  }
  return completeSuccess;
};

const generatePage = async (handler: MiddlewareHandler, url: URL, ctx: Context) => {
  const { pathname } = url;
  try {
    const req = new Request(url);
    const response = await handler(req, ctx);
    const path = parseContentDisposition(response.headers.get("Content-Disposition")) || pathname;
    if (!response.ok) {
      console.warn(`\nWARNING: skipped path ${pathname} since it returned HTTP ${response.status}:
${await response.text()}`);
      return false;
    }
    return { response, outFilePath: path.endsWith("/") ? `${path}index.html` : path };
  } catch (e) {
    console.error(`\nERROR: failed to generate path ${pathname}\n `, e);
    return false;
  }
};

const parseContentDisposition = (val: string | null) => val?.match(/filename="?([^";]+)"?/i)?.[1];

const writeFile = async (path: string, data: ReadableStream<Uint8Array> | Buffer) => {
  const { createWriteStream } = await import("node:fs");
  const { Readable } = await import("node:stream");
  return new Promise<void>((resolve, reject) =>
    Readable.fromWeb(data as any)
      .pipe(createWriteStream(path))
      .on("finish", resolve)
      .on("error", reject)
  );
};

const createRouter = (routes: Route[]) => ({
  name: "router",
  handler: routeHandler(routes),
  getStaticPaths: async (ctx: GeneratorContextBase) => {
    const rs = ctx.onlyPregenerate ? routes.filter((r) => r.pregenerate) : routes;
    const paths = rs.toReversed().map(async (r) => {
      if (r.pattern.hasRegExpGroups) {
        if (typeof r.getStaticPaths !== "function") throw Error(r.name + errMsg);
        return validateStaticPaths(r.name, await r.getStaticPaths());
      } else {
        return r.pattern.pathname;
      }
    });
    return (await Promise.all(paths)).flat();
  },
});
const errMsg = " should export a function named getStaticPaths, returning an array of strings.";

const validateStaticPaths = (name: string, paths: string[]) => {
  if (!Array.isArray(paths)) throw Error(name + notStringMsg);
  for (const path of paths) {
    if (typeof path !== "string") throw Error(name + notStringMsg);
    if (path[0] !== "/") throw Error(name + "#getStaticPaths: paths must start with a slash (/)");
    if (!path.endsWith("/") && !extname(path) && !path.startsWith("/.well-known/")) {
      console.warn(`\nWARNING: ${name} has path ${path} without file extension.
  Consider renaming route to e.g. ${name.replace(".server", ".html.server")}\n`);
    }
  }
  return paths;
};
const notStringMsg = "#getStaticPaths must return an array of strings";


export class GenerateError extends Error {}
