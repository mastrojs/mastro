/**
 * This module contains all functions related to static site generation.
 * It is used both by the [vscode-extension](../vscode-extension/) and
 * by the [static site generator on the CLI](https://mastrojs.github.io/docs/install-setup/#generate-a-static-site).
 * @module
 */

import type { Stats } from "node:fs";
import { extname } from "node:path";
import type { ParseArgsOptionDescriptor } from "node:util";

import { findFiles, sep } from "./core/fs.ts";
import type { RouteNew } from "./routers/common.ts";
import { hasRouteParams, loadRoutes } from "./routers/fileRouter.ts";
import type { Middleware } from "./middleware.ts";

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
  middleware?: Middleware;
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
  routes?: RouteNew[];
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
  const { createHash } = await import("node:crypto");
  const fs = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const { fileURLToPath, pathToFileURL } = await import("node:url");
  const fileBasedRouter = !opts.routes;
  const {
    assetsFolder = "_assets",
    middleware,
    outFolder = "generated",
    onlyPregenerate = false,
    routes = await loadRoutes(),
  } = opts;
  const assetsPrefix = assetsFolder ? sep + assetsFolder + sep : undefined;

  const isAsset = (path: string) => assetsPrefix && path.startsWith(assetsPrefix) && extname(path);
  const assetHashes: Record<string, string> = {};
  const getAssetPath = (path: string, data: Buffer) => {
    const ext = extname(path);
    const hash = createHash("sha256").update(data).digest("hex").slice(0, 8);
    const hashedPath = `${path.slice(0, -1 * ext.length)}-${hash}${ext}`;
    assetHashes[pathToFileURL(path).pathname.slice(assetsPrefix?.length)] = hashedPath;
    return hashedPath;
  };
  const writeJSON = (path: string, data: object) =>
    fs.writeFile(path, JSON.stringify(data, null, 2) + "\n");

  if (fileBasedRouter && routes.length === 0) {
    await ensureDir(fs.stat("routes"));
  }
  await fs.rm(outFolder, { force: true, recursive: true });
  await fs.mkdir(outFolder);

  if (fileBasedRouter && opts.writeRoutenames) {
    await writeJSON(".routenames.json", routes.map((r) => r.name));
  }

  // for (const route of routes) {
  //   const { getStaticPaths } = route;
  //   const paths = getStaticPaths
  //     ? validateGetStaticPaths(route.name, await getStaticPaths())
  //     : [ /* TODO */];
  // }

  let completeSuccess = true;
  for (const route of routes) {
    const { name } = route;
    if (route.method === "GET" && (!onlyPregenerate || route.pregenerate)) {
      if (fileBasedRouter && hasRouteParams(name) && typeof route.getStaticPaths !== "function") {
        throw Error(
          name + " should export a function named getStaticPaths, returning an array of strings.",
        );
      }
      for (const file of await generatePagesForRoute(route, opts.baseUrl)) {
        if (file === false) {
          completeSuccess = false;
        } else if (file) {
          const outPath = outFolder + file.outFilePath;
          await fs.mkdir(dirname(outPath), { recursive: true });
          const { body } = file.response;
          if (body) {
            let data;
            let { outFilePath } = file;
            if (isAsset(outFilePath)) {
              data = await file.response.arrayBuffer().then(Buffer.from);
              outFilePath = getAssetPath(outFilePath, data);
            }
            await writeFile(outFolder + outFilePath, data || body);
          }
        }
      }
    }
  }

  const fetchUpstream = async (req: Request) =>
    new Response(await fs.readFile("routes" + fileURLToPath(req.url)));
  for (const filePath of await getStaticFilePaths()) {
    await fs.mkdir(dirname(outFolder + filePath), { recursive: true });
    if (middleware) {
      const req = new Request(pathToFileURL(filePath));
      const res = await middleware(req, { mode: "generator", fetchUpstream });
      if (res.body) {
        // TODO: filePath = res.headers.get("Content-Disposition");
        await writeFile(outFolder + filePath, res.body);
      }
    } else {
      await fs.copyFile("routes" + filePath, outFolder + filePath);
    }

    /*
    if (filePath.endsWith(".client.ts")) {
      const { tsToJs } = await import("./tsToJs.ts");
      const text = await fs.readFile("routes" + filePath, { encoding: "utf8" });
      await fs.writeFile(outFolder + filePath.slice(0, -3) + ".js", await tsToJs(text));
    } else {
      const outPath = isAsset(filePath)
        ? getAssetPath(filePath, await fs.readFile("routes" + filePath))
        : filePath;
      await fs.copyFile("routes" + filePath, outFolder + outPath);
    }
    */
  }

  if (assetsPrefix && Object.keys(assetHashes).length > 0) {
    await writeJSON("generatedAssets.json", assetHashes);
  }

  completeSuccess
    ? console.info(`Generated static site and wrote to ${outFolder}/ folder.`)
    : process.exit(1);
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
  baseUrl = "http://127.0.0.1",
): Promise<Array<{ outFilePath: string; response: Response } | false | undefined>> => {
  const { name, getStaticPaths } = route;
  const paths = getStaticPaths
    ? validateGetStaticPaths(name, await getStaticPaths())
    : [route.pattern.pathname];
  return Promise.all(paths.map((p) => generatePage(route, new URL(baseUrl + p))));
};

const generatePage = async (route: Route, url: URL) => {
  const { pathname } = url;
  try {
    const req = new Request(url);
    (req as any)._params = route.pattern.exec(url)?.pathname.groups;
    const response = await route.handler(req);
    if (response instanceof Response) {
      const outFilePath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
      if (response.ok) {
        if (!extname(outFilePath) && !outFilePath.startsWith("/.well-known/")) {
          console.warn(`\nWARNING: ${route.name} generated file ${outFilePath} without file extension.
    Consider renaming route to e.g. ${route.name.replace(".server", ".html.server")}\n`);
        }
        return { outFilePath, response };
      } else if (response.status >= 500) {
        throw `received HTTP ${response.status}: ${await response.text()}`;
      }
    } else {
      console.warn(route.name + ": GET must return a Response object");
    }
  } catch (e) {
    console.error(`\nFailed to generate path ${pathname} on route ${route.name}\n `, e);
    return false;
  }
};

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
  (await findFiles(["routes/**/*", "routes/**/.*/**/*"]))
    .filter(isStaticFile).map((p) => p.slice(6));

const isStaticFile = (p: string) => !p.endsWith(".server.ts") && !p.endsWith(".server.js");

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
