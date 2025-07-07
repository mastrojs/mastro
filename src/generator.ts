/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by `deno task generate`.
 * @module
 */

import { findFiles } from "./fs.ts";
import { paramRegex, routes } from "./router.ts";

/**
 * Generate all pages for the static site and write them to disk.
 * Can only be used with Deno and not the VSCode extension.
 */
export const generate = async (outFolder = "dist"): Promise<void> => {
  const { exists } = await import("@std/fs/exists");
  const { dirname, toFileUrl } = await import("@std/path");
  const { tsToJs } = await import("./server.ts");

  if (await exists(outFolder, { isDirectory: true })) {
    await Deno.remove(outFolder, { recursive: true });
  }

  try {
    for (const { filePath } of routes) {
      const module = await import(toFileUrl(Deno.cwd() + filePath).toString());

      for (const file of await generatePagesForRoute(filePath, module)) {
        if (file) {
          const outFilePath = outFolder + file.outFilePath;
          await Deno.mkdir(dirname(outFilePath), { recursive: true });
          Deno.writeTextFile(outFilePath, file.output);
        }
      }
    }
  } catch (e) {
    console.error(e);
  }

  for (const filePath of await getStaticFilePaths()) {
    if (filePath.endsWith(".client.ts")) {
      const text = await Deno.readTextFile("routes" + filePath);
      Deno.writeTextFile(outFolder + filePath.slice(0, -3) + ".js", tsToJs(text));
    } else {
      Deno.copyFile("routes" + filePath, outFolder + filePath);
    }
  }

  console.info(`Generated static site and wrote to ${outFolder}/ folder.`);
};

/**
 * Takes a file path for a route file on the local filesystem, runs the
 * static site generation logic and returns an array of output strings
 * and their respective output file paths. However, this function itself
 * doesn't actually write anything to disk. Instead, it's called by `generate`
 * and by the VSCode extension.
 */
export const generatePagesForRoute = async (
  filePath: string,
  module: any,
): Promise<Array<{ outFilePath: string; output: string } | undefined>> => {
  const { GET, getStaticPaths } = module;
  if (typeof GET === "function") {
    let urls = [new URL(filePathToUrlPath(filePath))];

    if (filePath.split("/").some((segment) => segment.match(paramRegex))) {
      if (typeof getStaticPaths !== "function") {
        throw Error(filePath + " should export a function named getStaticPaths");
      }
      const paths = await getStaticPaths();
      if (Array.isArray(paths) && (paths.length === 0 || typeof paths[0] === "string")) {
        urls = paths.map((p) => {
          if (p[0] !== "/") {
            throw Error(filePath + "#getStaticPaths: paths must start with a slash (/)");
          }
          return new URL(urlPrefix + p);
        });
      } else {
        throw Error(filePath + "#getStaticPaths must return an array of strings");
      }
    }

    return Promise.all(urls.map((u) => generatePage(filePath, GET, u)));
  } else {
    throw Error(filePath + " should export a function named GET");
  }
};

/**
 * Return the paths of all non-route files from the the local filesystem.
 * It's called by `generate` and by the VSCode extension.
 */
export const getStaticFilePaths = async (): Promise<string[]> =>
  (await findFiles("routes/**/*"))
    .filter(isStaticFile).map((p) => p.slice(7));

const isStaticFile = (p: string) =>
  !p.endsWith(".server.ts") && !p.endsWith(".server.js") &&
  !p.endsWith("/.DS_Store");

const generatePage = async (
  filePath: string,
  GET: (req: Request) => Promise<Response>,
  url: URL,
) => {
  const res = await GET(new Request(url));
  if (res instanceof Response) {
    const output = await res.text();
    const path = url.pathname;
    return {
      outFilePath: ensureTrailingSlash(path) + "index.html",
      output,
    };
  } else {
    console.warn(filePath + ": GET must return a Response object");
  }
};

const filePathToUrlPath = (path: string) => {
  path = removeRoutesAndServerTs(path);
  if (path.endsWith("/index")) {
    path = path.slice(0, -5); // '/index' -> '/'
  }
  return urlPrefix + path;
};

const removeRoutesAndServerTs = (path: string) => path.slice(7, -10);

// just a dummy prefix so `new URL` doesn't throw
const urlPrefix = "http://localhost";

const ensureTrailingSlash = (path: string) => path.endsWith("/") ? path : path + "/";
