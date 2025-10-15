/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by `deno task generate`.
 * @module
 */
import process from "node:process";
import type { Stats } from "node:fs";

import { findFiles, sep } from "./core/fs.ts";
import { paramRegex, routes } from "./core/router.ts";

interface GenerateConfig {
  /**
   * Folder name for output folder that will be created. Default is `generated`.
   */
  outFolder?: string;
  /**
   * Pregenerate only routes with `export const pregenerate = true`.
   * Useful as a build step for servers.
   */
  pregenerateOnly?: boolean;
}

/**
 * Generate all pages for the static site and write them to disk.
 * Can only be used with Deno and not the VSCode extension.
 */
export const generate = async (config?: GenerateConfig): Promise<void> => {
  const fs = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const { pathToFileURL } = await import("node:url");

  const { outFolder = "generated", pregenerateOnly = false } = config || {};
  const pregenerateAll = !pregenerateOnly;

  await ensureDir(fs.stat("routes"));
  await fs.rm(outFolder, { force: true, recursive: true });
  try {
    for (const route of routes) {
      const module = await import(pathToFileURL(process.cwd() + route.filePath).toString());

      if (pregenerateAll || module.pregenerate) {
        for (const file of await generatePagesForRoute(route, module)) {
          if (file) {
            const outFilePath = outFolder + file.outFilePath;
            await fs.mkdir(dirname(outFilePath), { recursive: true });
            const { body } = file.response;
            if (body) {
              if (typeof Deno === "object") {
                Deno.writeFile(outFilePath, body);
              } else {
                const { createWriteStream } = await import("node:fs");
                const { Readable } = await import('node:stream');
                // deno-lint-ignore no-explicit-any
                Readable.fromWeb(body as any).pipe(createWriteStream(outFilePath));
              }
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
      const { tsToJs } = await import("./server.ts");
      const text = await fs.readFile("routes" + filePath, { encoding: "utf8" });
      fs.writeFile(outFolder + filePath.slice(0, -3) + ".js", await tsToJs(text));
    } else if (pregenerateAll) {
      const outPath = outFolder + filePath;
      await fs.mkdir(dirname(outPath), { recursive: true });
      await fs.copyFile("routes" + filePath, outPath);
    }
  }

  console.info(`Generated static site and wrote to ${outFolder}/ folder.`);
};

if (typeof document === "undefined" && import.meta.main) {
  const { parseArgs } = await import("node:util");
  const flags = parseArgs({
    options: {
      outFolder: {
        type: "string",
      },
      pregenerateOnly: {
        type: "boolean",
      },
    }
  });
  generate(flags.values);
}

/**
 * Takes a file path for a route file on the local filesystem, runs the
 * static site generation logic and returns an array of output strings
 * and their respective output file paths. However, this function itself
 * doesn't actually write anything to disk. Instead, it's called by `generate`
 * and by the VSCode extension.
 */
export const generatePagesForRoute = async (
  route: { filePath: string; pattern: URLPattern },
  module: any,
): Promise<Array<{ outFilePath: string; response: Response } | undefined>> => {
  const { filePath } = route;
  const { GET, getStaticPaths } = module;
  if (typeof GET === "function") {
    const urls = filePath.split(sep).some((segment) => segment.match(paramRegex))
      ? await getStaticUrls(filePath, getStaticPaths)
      : [new URL(urlPrefix + route.pattern.pathname)];
    return Promise.all(urls.map((u) => generatePage(filePath, GET, u)));
  } else {
    throw Error(filePath + " should export a function named GET");
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
}

/**
 * Return the paths of all non-route files from the the local filesystem.
 * It's called by `generate` and by the VSCode extension.
 */
export const getStaticFilePaths = async (): Promise<string[]> =>
  (await findFiles("routes/**/*"))
    .filter(isStaticFile).map((p) => p.slice(7));

const isStaticFile = (p: string) =>
  !p.endsWith(".server.ts") && !p.endsWith(".server.js");

const generatePage = async (
  filePath: string,
  GET: (req: Request) => Promise<Response>,
  url: URL,
) => {
  try {
    const response = await GET(new Request(url));
    if (response instanceof Response) {
      const path = url.pathname;
      return {
        outFilePath: path.endsWith("/") ? `${path}index.html` : path,
        response,
      };
    } else {
      console.warn(filePath + ": GET must return a Response object");
    }
  } catch (e) {
    console.error(`\nFailed to generate page with path ${url.pathname}\n`, e);
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
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === "ENOENT") {
      console.error(noRoutesMsg);
      process.exit(1);
    } else {
      throw e;
    }
  }
}

// just a dummy prefix so `new URL` doesn't throw
const urlPrefix = "http://127.0.0.1";
