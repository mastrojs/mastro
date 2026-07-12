/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by the [static site generator on the CLI](https://mastrojs.github.io/docs/install-setup/#generate-a-static-site).
 * @module
 */

import type { Stats } from "node:fs";
import { extname } from "node:path";
import type { ParseArgsOptionDescriptor } from "node:util";

import { hasRouteParams, loadRoutes } from "./routers/fileRouter.ts";
import { chainMiddlewares, MiddlewareError } from "./middleware.ts";
import type { MiddlewareHandler, Middleware } from "./middleware.ts";

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
   * to make them distinguishable from request from localhost (see `isDevServer`).
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
  /**
   * For use with the programmatic router. Default is to fall back on the file-based router.
   */
  routes?: Middleware[];
  /**
   * Generate `.routenames.json`, which the file-based router needs when using a bundled server.
   */
  writeRoutenames?: boolean;
}

/**
 * Generate all pages for the static site and write them to disk.
 *
 * Can not be used in the VSCode extension.
 */
export const generate = async (opts: GenerateOpts = {}): Promise<void> => {
  const fs = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const { fileURLToPath, pathToFileURL } = await import("node:url");
  const fileBasedRouter = !opts.routes;
  const {
    baseUrl = "http://127.0.0.1",
    outFolder = "generated",
    onlyPregenerate = false,
    routes = await loadRoutes(),
  } = opts;
  if (fileBasedRouter && routes.length === 0) {
    await ensureDir(fs.stat("routes"));
  }
  await fs.rm(outFolder, { force: true, recursive: true });
  await fs.mkdir(outFolder);

  const paths: string[] = [];
  for (const route of routes) {
    if ("getStaticPaths" in route) {
      const { getStaticPaths } = route;
      if (getStaticPaths) {
        paths.push(...validateGetStaticPaths(route.name, await getStaticPaths()))
      }
    }
  }
  const handler = chainMiddlewares(routes);

  let completeSuccess = true;
  for (const path of paths) {
    // TODO: parallelize without opening too many file handles at once
    const file = await generatePage(handler, new URL(baseUrl + path));
    if (file === false) {
      completeSuccess = false;
    } else if (file) {
      // TODO: file.outFilePath = res.headers.get("Content-Disposition");
      const outPath = outFolder + file.outFilePath; // call pathToFileURL here?
      await fs.mkdir(dirname(outPath), { recursive: true });
      const { body } = file.response;
      if (body) {
        await writeFile(outPath, body);
      }
    }
  }
  completeSuccess
    ? console.info(`Generated static site and wrote to ${outFolder}/ folder.`)
    : process.exit(1);
};


const generatePage = async (handler: MiddlewareHandler, url: URL) => {
  const { pathname } = url;
  try {
    const req = new Request(url);
    const response = await handler(req, { mode: "generator", fetchUpstream } );
    const outFilePath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    if (response.ok) {
      return { outFilePath, response };
    }
  } catch (e) {
    const name = e instanceof MiddlewareError ? e.middlewareName : "";
    console.error(`\nFailed to generate path ${pathname} in ${name}\n `, e);
    return false;
  }
};
const fetchUpstream = () => new Response("Not found", { status: 404 });

const validateGetStaticPaths = (name: string, paths: string[]) => {
  if (!Array.isArray(paths)) throw Error(name + notStringMsg);
  for (const path of paths) {
    if (typeof path !== "string") throw Error(name + notStringMsg);
    if (path[0] !== "/") throw Error(name + "#getStaticPaths: paths must start with a slash (/)");

    // TODO: move following check to after generation to exclude 404s?
    // maybe together with check warn if getStaticPaths returns N paths but not N pages were generated from it
    if (!path.endsWith("/") && !extname(path) && !path.startsWith("/.well-known/")) {
      console.warn(`\nWARNING: ${name} generated file ${path} without file extension.
Consider renaming route to e.g. ${name.replace(".server", ".html.server")}\n`);
    }
  }
  return paths;
};
const notStringMsg = "#getStaticPaths must return an array of strings";

const writeFile = async (path: string, data: ReadableStream<Uint8Array> | Buffer) => {
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

if (typeof document === "undefined" && import.meta.main) {
  const { parseArgs } = await import("node:util");

  const options: { [opt: string]: ParseArgsOptionDescriptor & { description: string } } = {
    help: {
      description: "Print this help page",
      type: "boolean",
      short: "h",
    },
    "assets-folder": {
      description: "Files in this folder get hashed output names. Default is `_assets`. " +
        'To disable, use --assets-folder=""',
      type: "string",
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
    "write-routenames": {
      description: "Generate `.routenames.json`. Only needed with the file-based router " +
        "when also using a bundled server.",
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
        baseUrl: values["base-url"] as string | undefined,
        assetsFolder: values["assets-folder"] as string | undefined,
        outFolder: values.output as string | undefined,
        onlyPregenerate: !!values["only-pregenerate"],
        writeRoutenames: !!values["write-routenames"],
      });
    }
  } catch (e: any) {
    console.error(`\n${e.message || e}`);
    process.exit(1);
  }
}
