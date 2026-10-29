#!/usr/bin/env node
/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by the [static site generator on the CLI](https://mastrojs.github.io/docs/install-setup/#generate-a-static-site).
 * @module
 */

import { statSync } from "node:fs";
import type { ParseArgsOptionDescriptor } from "node:util";

import type { Mastro, Route } from "./core/mastro.ts";
import { chainMiddlewares, type Context, type GeneratorContext, type GeneratorContextBase, type MiddlewareHandler } from "./middleware.ts";
import { createFileRouterApp, defaultMiddlewares } from "./server.ts";
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
    middlewares.unshift(...defaultMiddlewares);
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


class GenerateError extends Error {}

if (typeof document === "undefined" && import.meta.main) {
  const { resolve } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const { parseArgs } = await import("node:util");

  const options: { [opt: string]: ParseArgsOptionDescriptor & { description: string } } = {
    help: {
      description: "Print this page",
      type: "boolean",
      short: "h",
    },
    "base-url": {
      description: "Base URL for the synthetic requests, defaults to http://127.0.0.1",
      type: "string",
    },
    output: {
      description: "Name of output folder that will be created, defaults to `generated`",
      type: "string",
    },
    "only-pregenerate": {
      description: "Only pregenerate routes with `export const pregenerate = true`",
      type: "boolean",
    },
  };
  try {
    const { values, positionals } = parseArgs({ options, allowPositionals: true });
    if (values.help || positionals[0] !== "generate") {
      const keys = Object.keys(options);
      const maxKeyLen = Math.max(...keys.map((k) => k.length));
      const opts = keys.map((key) => ` --${key.padEnd(maxKeyLen)}  ${options[key]?.description}`);
      console.info("Usage: mastro generate [options]\n\n" + opts.join("\n"));
    } else {
      const exists = (entry: string) => {
        const path = pathToFileURL(resolve(entry));
        return statSync(path, { throwIfNoEntry: false })?.isFile() ? path.href : undefined;
      }
      const server = exists("server.ts") || exists("server.js");
      if (!server) {
        console.info("Using file-based router.");
      }
      const app = server ? await import(server).then(m => m.app as Mastro) : createFileRouterApp();
      const success = await generate(app, {
        baseUrl: values["base-url"] as string | undefined,
        outFolder: values.output as string | undefined,
        onlyPregenerate: !!values["only-pregenerate"],
      });
      if (!success) process.exit(1);
    }
  } catch (e: any) {
    console.error(`\n${e instanceof GenerateError ? e.message : e}`);
    process.exit(1);
  }
}
