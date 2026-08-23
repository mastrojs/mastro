/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by the [static site generator on the CLI](https://mastrojs.github.io/docs/install-setup/#generate-a-static-site).
 * @module
 */

import type { Stats } from "node:fs";
import type { ParseArgsOptionDescriptor } from "node:util";

import { chainMiddlewares } from "./middleware/middleware.ts";
import type { Middleware, MiddlewareHandler } from "./middleware/middleware.ts";
import { defaultMiddlewares } from "./middleware/defaultMiddlewares.ts";
import { createFileRouter } from "./middleware/middlewares/fileRouter.ts";

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
   * Custom middlewares.
   */
  middlewares?: Middleware[];
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
  const {
    baseUrl = "http://127.0.0.1",
    outFolder = "generated",
    onlyPregenerate = false,
    middlewares = defaultMiddlewares.concat(createFileRouter({ onlyPregenerate })),
  } = opts;
  if (middlewares.some((m) => m.name === "fileRouter")) {
    await ensureDir(fs.stat("routes"));
  }
  await fs.rm(outFolder, { force: true, recursive: true });
  await fs.mkdir(outFolder);

  const handler = chainMiddlewares(middlewares);

  let completeSuccess = true;
  for (const m of middlewares) {
    if ("getStaticPaths" in m && m.getStaticPaths) {
      for (const path of await m.getStaticPaths()) {
        // TODO: parallelize without opening too many file handles at once
        const file = await generatePage(handler, new URL(baseUrl + path), onlyPregenerate);
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
  if (!completeSuccess) process.exit(1);
  const ctx = { mode: "generator" as const, onlyPregenerate };
  await Promise.all(middlewares.map((m) => "afterGenerate" in m ? m.afterGenerate?.(ctx) : null));
  console.info(`Generated static site and wrote to ${outFolder} folder.`);
};

const generatePage = async (handler: MiddlewareHandler, url: URL, onlyPregenerate: boolean) => {
  const { pathname } = url;
  try {
    const req = new Request(url);
    const response = await handler(req, { mode: "generator", onlyPregenerate, fetchUpstream });
    const path = parseContentDisposition(response.headers.get("Content-Disposition")) || pathname;
    if (!response.ok) {
      console.warn(`\nWARNING: skipped path ${pathname} since it returned HTTP ${response.status}:
${await response.text()}`);
    }
    return { response, outFilePath: path.endsWith("/") ? `${path}index.html` : path };
  } catch (e) {
    console.error(`\nERROR: failed to generate path ${pathname}\n `, e);
    return false;
  }
};

const parseContentDisposition = (val: string | null) => val?.match(/filename="?([^";]+)"?/i)?.[1];

const fetchUpstream = () => new Response("Not found", { status: 404 });

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
    const values = parseArgs({ options }).values;
    if (values.help) {
      const keys = Object.keys(options);
      const maxKeyLen = Math.max(...keys.map((k) => k.length));
      const opts = keys.map((key) => ` --${key.padEnd(maxKeyLen)}  ${options[key].description}`);
      console.info("Options:\n" + opts.join("\n"));
    } else {
      await generate({
        baseUrl: values["base-url"] as string | undefined,
        outFolder: values.output as string | undefined,
        onlyPregenerate: !!values["only-pregenerate"],
      });
    }
  } catch (e: any) {
    console.error(`\n${e.message || e}`);
    process.exit(1);
  }
}
