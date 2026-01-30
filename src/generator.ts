/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by the [static site generator on the CLI](https://mastrojs.github.io/docs/install-setup/#generate-a-static-site).
 * @module
 */

import type { Stats } from "node:fs";
import type { ParseArgsOptionDescriptor } from "node:util";
import { extension } from "@std/media-types";
import { extname } from "@std/path/posix/extname";

import { findFiles } from "./core/fs.ts";
import type { Route } from "./routers/common.ts";
import { hasRouteParams, loadRoutes } from "./routers/fileRouter.ts";

/**
 * Config options for `generate`
 */
export interface GenerateOpts {
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
  /**
   * For use with the programmatic router. Default is to fall back on the file-based router.
   */
  routes?: Route[];
}

/**
 * Generate all pages for the static site and write them to disk.
 * Can only be used with Deno or Node.js – not in the VSCode extension.
 */
export const generate = async (opts: GenerateOpts = {}): Promise<void> => {
  const fs = await import("node:fs/promises");
  const { dirname } = await import("node:path");

  const fileBasedRouter = !opts.routes;
  const { outFolder = "generated", onlyPregenerate = false, routes = await loadRoutes() } = opts;

  if (fileBasedRouter && routes.length === 0) {
    await ensureDir(fs.stat("routes"));
  }
  await fs.rm(outFolder, { force: true, recursive: true });
  await fs.mkdir(outFolder);

  for (const route of routes) {
    const { name } = route;
    if (route.method === "GET" && (!onlyPregenerate || route.pregenerate)) {
      if (fileBasedRouter && hasRouteParams(name) && typeof route.getStaticPaths !== "function") {
        throw Error(
          name + " should export a function named getStaticPaths, returning an array of strings.",
        );
      }
      for (const file of await generatePagesForRoute(route)) {
        if (file) {
          const outFilePath = outFolder + file.outFilePath;
          await fs.mkdir(dirname(outFilePath), { recursive: true });
          const { body } = file.response;
          if (body) {
            await writeFile(outFilePath, body);
          }
        }
      }
    }
  }

  for (const filePath of await getStaticFilePaths()) {
    if (filePath.endsWith(".client.ts")) {
      const { tsToJs } = await import("./staticFiles.ts");
      const text = await fs.readFile("routes" + filePath, { encoding: "utf8" });
      await fs.writeFile(outFolder + filePath.slice(0, -3) + ".js", await tsToJs(text));
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
): Promise<Array<{ outFilePath: string; response: Response } | undefined>> => {
  const { name, getStaticPaths } = route;
  const paths = getStaticPaths
    ? validateGetStaticPaths(name, await getStaticPaths())
    : [route.pattern.pathname];
  return Promise.all(paths.map((p) => generatePage(route, new URL(urlPrefix + p))));
};

const generatePage = async (route: Route, url: URL) => {
  const { pathname } = url;
  try {
    const req = new Request(url);
    (req as any)._params = route.pattern.exec(url)?.pathname.groups;
    const response = await route.handler(req);
    if (response instanceof Response) {
      const outFilePath = pathname.endsWith("/")
        ? `${pathname}index.html`
        : addExtension(pathname, response.headers);
      return { outFilePath, response };
    } else {
      console.warn(route.name + ": GET must return a Response object");
    }
  } catch (e) {
    console.error(`\nFailed to generate path ${pathname} on route ${route.name}\n`, e);
  }
};

const addExtension = (path: string, headers: Headers) =>
  extname(path) ? path : `${path}.${extension(headers.get("Content-Type") || "") || "html"}`;

const validateGetStaticPaths = (name: string, paths: string[]) => {
  if (!Array.isArray(paths) || (paths.length > 0 && typeof paths[0] !== "string")) {
    throw Error(name + "#getStaticPaths must return an array of strings");
  }
  if (paths.some((p) => p[0] !== "/")) {
    throw Error(name + "#getStaticPaths: paths must start with a slash (/)");
  }
  return paths;
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
    console.error(e.code === "ENOENT" ? noRoutesMsg : e);
    process.exit(1);
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
  try {
    const values = parseArgs({ options }).values;
    if (values.help) {
      const keys = Object.keys(options);
      const maxKeyLen = Math.max(...keys.map((k) => k.length));
      const opts = keys.map((key) => ` --${key.padEnd(maxKeyLen)}  ${options[key].description}`);
      console.info("Options:\n" + opts.join("\n"));
    } else {
      await generate({
        outFolder: values.output as string,
        onlyPregenerate: !!values["only-pregenerate"],
      });
    }
  } catch (e: any) {
    console.error(`\n${e.message || e}`);
    process.exit(1);
  }
}
