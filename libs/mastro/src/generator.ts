/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../../../vscode-extension/) and
 * by the [static site generator on the CLI](https://mastrojs.github.io/docs/install-setup/#generate-a-static-site).
 * @module
 */

import fs from "node:fs/promises";
import { dirname, join, posix } from "node:path";

import { urlPathToFilePath } from "./core/fsHelpers.ts";
import { routeHandler } from "./core/routeHelpers.ts";
import type { Mastro } from "./mastro.ts";
import { chainMiddlewares } from "./middleware.ts";
import { middlewares } from "./servers/server.ts";
import type { Handler, Route, Simplify } from "./types/mastro.d.ts";
import type { Context, GeneratorCtxSimple } from "./types/middleware.d.ts";

/**
 * Generate all pages for the static site and write them to disk.
 *
 * Can not be used in the VSCode extension.
 */
export const generate = async <E extends unknown[], L>(
  app: Mastro<E, L>,
  opts: Simplify<Partial<GeneratorCtxSimple<Context<E>>> & { concurrency?: number }> = {},
): Promise<boolean> => {
  const ctx = {
    baseUrl: opts.baseUrl || "http://127.0.0.1",
    extras: (opts.extras || []) as E,
    onlyPregenerate: !!opts.onlyPregenerate,
    outFolder: opts.outFolder || "generated",
    mode: "generator",
  } satisfies GeneratorCtxSimple<Context<E>>;
  const { outFolder } = ctx;

  const resetP = fs.rm(outFolder, { force: true, recursive: true }).then(() => fs.mkdir(outFolder));

  const ms = app.getMiddlewares();
  if (ms.every((m) => m.name !== "staticFiles")) {
    // when we get passed an app for Cloudflare Workers or similar, we add staticFiles etc.
    console.info("Did not find a staticFiles middleware, adding defaultMiddlewares.\n");
    ms.unshift(...middlewares);
  }

  const routes = await app.getRoutes();
  const handler = chainMiddlewares(ms, routeHandler(routes));

  await resetP;
  await Promise.all(ms.map((m) => ("beforeGenerate" in m ? m.beforeGenerate?.(ctx) : null)));
  let completeSuccess = true;

  const renderPages = async (paths: string[]) => {
    const sharedIterator = paths.values();
    await Promise.all(
      // Generate pages concurrently, defaulting to a maximum of 16 at a time:
      Array.from({ length: Math.min(opts.concurrency || 16, paths.length) }, async () => {
        for (const path of sharedIterator) {
          const url = new URL(path, ctx.baseUrl);
          const context = { ...ctx, locals: {}, params: {} };
          const { response, outFilePath } = await generatePage(handler, url, context);
          if (response.ok) {
            const outPath = join(outFolder, outFilePath);
            await fs.mkdir(dirname(outPath), { recursive: true });
            if (response.body) {
              await fs.writeFile(outPath, response.body);
            } else {
              console.warn(`\nWARNING: ${path} returned no body (HTTP ${response.status})\n.`);
            }
          } else if (response.status !== 404) {
            completeSuccess = false;
          }
        }
      }),
    );
  };

  const routeMiddleware = createRouteMiddleware(routes, ctx.onlyPregenerate);
  const { assetPaths, otherPaths } = await getPaths(ctx, ...ms, ...routeMiddleware);
  await renderPages(assetPaths);
  await renderPages(otherPaths);

  if (completeSuccess) {
    await Promise.all(ms.map((m) => ("afterGenerate" in m ? m.afterGenerate?.(ctx) : null)));
    console.info(`Generated static site and wrote to \`${outFolder}\` folder.`);
  }
  return completeSuccess;
};

/**
 * call getStaticPaths of all middlewares and set things up for the fingerprintAssets middleware.
 */
const getPaths = async <E, C = GeneratorCtxSimple<Context<E>>>(ctx: C, ...middlewares: Mw<C>[]) => {
  (globalThis as any)._mastroAssets = {};
  const paths = middlewares.flatMap(async (m) =>
    m.getStaticPaths ? validateStaticPaths(m.name, await m.getStaticPaths(ctx), m.pattern) : [],
  );
  const assetPaths: string[] = [];
  const otherPaths: string[] = [];
  for (const p of (await Promise.all(paths)).flat()) {
    (p.startsWith("/_assets/") ? assetPaths : otherPaths).push(p);
  }
  return { assetPaths, otherPaths };
};
type Mw<C> = {
  name: string;
  pattern?: URLPattern;
  getStaticPaths?: (ctx: C) => Promise<string[]> | string[];
};

const generatePage = async <C>(handler: Handler<C>, url: URL, ctx: C) => {
  const req = new Request(url);
  const response = await handler(req, ctx);
  const filename = parseContentDisposition(response.headers.get("Content-Disposition"));
  const directory = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1);
  const path = filename ? directory + filename : url.pathname;
  const outFilePath = urlPathToFilePath(path.endsWith("/") ? `${path}index.html` : path);
  return { response, outFilePath };
};

const parseContentDisposition = (val: string | null) => val?.match(/filename="?([^";]+)"?/i)?.[1];

const validateStaticPaths = (name: string, paths: string[], pattern?: URLPattern) => {
  const prefix = `${name}#getStaticPaths`;
  const notStringMsg = " must return an array of strings";
  if (!Array.isArray(paths)) throw Error(prefix + notStringMsg);
  for (const path of paths) {
    if (typeof path !== "string") throw Error(prefix + notStringMsg);
    if (path.includes("#") || path.includes("?") || path.includes("\\")) {
      throw Error(`${prefix} must return encoded URL paths. Use encodeURIComponent.`);
    }
    if (pattern && !pattern.test({ pathname: path })) {
      throw Error(`${prefix} returned ${path}, which does not match its route`);
    }
    if (!path.endsWith("/") && !posix.extname(path) && !path.startsWith("/.well-known/")) {
      const advice = /\.server\.(js|ts)$/.test(name)
        ? `Consider renaming ${name} to ${name.replace(/\.server\.(js|ts)$/, ".html.server.$1")}.`
        : "Consider using URL paths ending in .html or /.";
      console.warn(`\nWARNING: ${name} has path ${path} without file extension.
  ${advice}\n`);
    }
  }
  return paths;
};

const createRouteMiddleware = <E>(routes: Route<Context<E>>[], onlyPregen: boolean) =>
  routes
    .filter((r) => (!onlyPregen || r.pregenerate) && (r.method === "GET" || r.method === "all"))
    .map((r) => ({
      name: r.name,
      pattern: r.pattern,
      getStaticPaths: async () => {
        if (typeof r.getStaticPaths === "function") return r.getStaticPaths();
        if (hasRouteParams.test(r.pattern.pathname)) throw Error(r.name + staticPathErrMsg);
        return [r.pattern.pathname.replace(/\\(.)/g, "$1")]; // unescape URLPattern syntax
      },
    }))
    .reverse();

// URLPattern parameters, wildcards, and groups require concrete paths:
const hasRouteParams = /(?<!\\)[:*{(]/;
const staticPathErrMsg = " should provide a getStaticPaths function returning an array of strings.";
