/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by `deno task generate`.
 * @module
 */

// deno-lint-ignore-file no-explicit-any

import type { Stats } from "node:fs";
import type { ParseArgsOptionDescriptor } from "node:util";

import { findFiles } from "./core/fs.ts";
import { getRoutes, hasRouteParams, type Route } from "./core/router.ts";

/**
 * Config options for `generate`
 */
export interface GenerateConfig {
  /**
   * Create a `.routes.json` file in current folder (not outFolder)
   * for later use with esbuild. Default is `false`.
   */
  generateRoutesFile?: boolean;
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
 * Can only be used with Deno or Node.js – not in the VSCode extension.
 */
export const generate = async (config?: GenerateConfig): Promise<void> => {
  const fs = await import("node:fs/promises");
  const { dirname } = await import("node:path");

  const { outFolder = "generated", onlyPregenerate = false } = config || {};

  await ensureDir(fs.stat("routes"));
  await fs.rm(outFolder, { force: true, recursive: true });
  await fs.mkdir(outFolder);

  try {
    for (const route of await getRoutes()) {
      const module = await route.module;
      if (!onlyPregenerate || module.pregenerate) {
        for (const file of await generatePagesForRoute(route, module)) {
          if (file) {
            const outFilePath = outFolder + file.outFilePath;
            await fs.mkdir(dirname(outFilePath), { recursive: true });
            const { body } = file.response;
            if (body) {
              writeFile(outFilePath, body);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
  }

  for (const filePath of await getStaticFilePaths()) {
    if (filePath.endsWith(".client.ts")) {
      const { tsToJs } = await import("./staticFiles.ts");
      const text = await fs.readFile("routes" + filePath, { encoding: "utf8" });
      fs.writeFile(outFolder + filePath.slice(0, -3) + ".js", await tsToJs(text));
    } else {
      const outPath = outFolder + filePath;
      await fs.mkdir(dirname(outPath), { recursive: true });
      await fs.copyFile("routes" + filePath, outPath);
    }
  }

  console.info(`Generated static site and wrote to ${outFolder}/ folder.`);
};

/**
 * Takes a file path for a route file on the local filesystem, runs the
 * static site generation logic and returns an array of `Response`s with
 * their respective output file paths. However, this function itself
 * doesn't actually write anything to disk. Instead, it's called by `generate`
 * and by the Mastro VSCode extension.
 */
export const generatePagesForRoute = async (
  route: Route,
  module: Record<string, unknown>,
): Promise<Array<{ outFilePath: string; response: Response } | undefined>> => {
  const { name } = route;
  const { GET, getStaticPaths } = module;
  if (typeof GET === "function") {
    const urls = hasRouteParams(name)
      ? await getStaticUrls(name, getStaticPaths)
      : [new URL(urlPrefix + route.pattern.pathname)];
    return Promise.all(urls.map((u) => generatePage(name, GET, u)));
  } else {
    throw Error(name + " should export a function named GET");
  }
};

// deno-lint-ignore ban-types
const generatePage = async (filePath: string, GET: Function, url: URL) => {
  try {
    const response = await GET(new Request(url));
    if (response instanceof Response) {
      const path = url.pathname;
      const outFilePath = path.endsWith("/") ? `${path}index.html` : path;
      return { outFilePath, response };
    } else {
      console.warn(filePath + ": GET must return a Response object");
    }
  } catch (e) {
    console.error(`\nFailed to generate page with path ${url.pathname}\n`, e);
  }
};

const getStaticUrls = async (filePath: string, getStaticPaths: unknown) => {
  if (typeof getStaticPaths !== "function") {
    throw Error(
      filePath +
        " should export a function named getStaticPaths, returning an array of strings.",
    );
  }
  const paths = await getStaticPaths();
  if (!Array.isArray(paths) || (paths.length > 0 && typeof paths[0] !== "string")) {
    throw Error(filePath + "#getStaticPaths must return an array of strings");
  }
  return paths.map((p) => {
    if (p[0] !== "/") {
      throw Error(filePath + "#getStaticPaths: paths must start with a slash (/)");
    }
    return new URL(urlPrefix + p);
  });
};

/**
 * Return the paths of all non-route files from the the local filesystem.
 * It's called by `generate` and by the VSCode extension.
 */
export const getStaticFilePaths = async (): Promise<string[]> =>
  (await findFiles("routes/**/*")).filter(isStaticFile).map((p) => p.slice(7));

const isStaticFile = (p: string) => !p.endsWith(".server.ts") && !p.endsWith(".server.js");

const writeFile = async (path: string, data: ReadableStream<Uint8Array>) => {
  if (typeof Deno === "object") {
    return Deno.writeFile(path, data);
  } else {
    // Bun.write doesn't accept a ReadableStream
    // and in my experiment failed silently when passed the original `Response` object.
    const { createWriteStream } = await import("node:fs");
    const { Readable } = await import("node:stream");
    return new Promise<void>((resolve, reject) =>
      Readable.fromWeb(data as any)
        .pipe(createWriteStream(path))
        .on("finish", resolve)
        .on("error", reject)
    );
  }
};

const ensureDir = async (statsP: Promise<Stats>) => {
  const noRoutesMsg = "No 'routes' folder found.\nAre you in the right place?";
  try {
    const routesDir = await statsP;
    if (!routesDir.isDirectory()) {
      console.error(noRoutesMsg);
      process.exit(1);
    }
  } catch (e: any) {
    if (e.code === "ENOENT") {
      console.error(noRoutesMsg);
      process.exit(1);
    } else {
      throw e;
    }
  }
};

// just a dummy prefix so `new URL` doesn't throw
const urlPrefix = "http://127.0.0.1";

if (typeof document === "undefined" && import.meta.main) {
  const { parseArgs } = await import("node:util");

  const options: { [opt: string]: ParseArgsOptionDescriptor & { description: string } } = {
    help: {
      description: "Print this help page",
      type: "boolean",
      short: "h",
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
  let values;
  try {
    values = parseArgs({ options }).values;
  } catch (e: any) {
    console.error(`\n${e.message || e}`);
    process.exit(1);
  }

  if (values.help) {
    const keys = Object.keys(options);
    const maxKeyLen = Math.max(...keys.map((k) => k.length));
    const opts = keys.map((key) => ` --${key.padEnd(maxKeyLen)}  ${options[key].description}`);
    console.info("Options:\n" + opts.join("\n"));
  } else {
    generate({
      outFolder: values.output as string,
      onlyPregenerate: !!values["only-pregenerate"],
    });
  }
}
