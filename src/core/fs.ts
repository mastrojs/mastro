/**
 * Lightweight wrapper around Node.js's file system functions and using RPC for the
 * [vscode-extension](../../vscode-extension/README.md).
 * Cloudflare Workers work with Node.js compatibility.
 * For Service Workers (where there is no filesystem), we just fall back to undefined, but at least
 * we don't want to break the module, hence no top-level await.
 */
import type { StandardSchemaV1 } from "./standard-schema.ts";

// in variables to prevent bundling by esbuild:
const nodeFs = "node:fs/promises";
const nodePath = "node:path";

// @ts-expect-error WorkerGlobalScope
const isWorker = typeof self !== "undefined" && self.WorkerGlobalScope && navigator.userAgent !== "Cloudflare-Workers";

const fs = typeof document === "object" || isWorker
  ? undefined
  : import(nodeFs) as Promise<typeof import("node:fs/promises")>;

// we use document.fs because dnt would add a shim for window https://github.com/denoland/dnt/issues/454
const vscodeExtensionFs = typeof document === "object"
  ? (document as any).fs
    : (isWorker ? (self as any).fs : undefined);

/**
 * Read the directory on the local file system and return its files,
 * non-recursive and ignoring symlinks.
 *
 * Input path needs to be relative to project root.
 */
export const readDir = async (path: string): Promise<string[]> =>
  fs
    ? (await fs).readdir(await noLeadingSep(path), { withFileTypes: true })
      .then((files) =>
        files.flatMap((file) =>
          file.isSymbolicLink() || file.isDirectory() || file.name[0] === "." ? [] : file.name
        )
      )
    : vscodeExtensionFs.readDir(leadingSlash(path));

/**
 * Return the contents of a text file on the local file system as a string.
 *
 * Input path needs to be relative to project root.
 */
export const readTextFile = async (path: string): Promise<string> =>
  fs
    ? (await fs).readFile(noLeadingSep(path), { encoding: "utf8" })
    : vscodeExtensionFs.readTextFile(leadingSlash(path));

/**
 * Return the contents of a binary file on the local file system.
 *
 * Input path needs to be relative to project root.
 */
export const readFile = async (path: string): Promise<Uint8Array<ArrayBufferLike>> =>
  fs
    ? (await fs).readFile(noLeadingSep(path))
    : vscodeExtensionFs.readFile(leadingSlash(path));

/**
 * Return the file paths on the local file system, relative to the current working directory,
 * expanding glob patterns like `*` and `**`. Do not pass it untrusted input.
 *
 * Returned paths are sorted alphabetically and don't start with a slash (or other path separator).
 *
 * Except for when using the Mastro VSCode extension, this is a thin wrapper around
 * [fs.glob](https://nodejs.org/api/fs.html#fspromisesglobpattern-options).
 *
 * In [VSCode for the Web](https://code.visualstudio.com/api/references/vscode-api#GlobPattern)
 * there is a [bug](https://github.com/microsoft/vscode/issues/249197) and we had to roll our own.
 */
export const findFiles = async (pattern: string | string[]): Promise<string[]> => {
  pattern = typeof pattern === "string" ? validatePattern(pattern) : pattern.map(validatePattern);
  if (fs) {
    const paths = [];
    // @ts-expect-error no type definitions for Bun
    if (typeof Bun === "object") {
      // until https://github.com/oven-sh/bun/issues/22018 is fixed
      const { glob, lstat } = await fs;
      for await (const file of glob(pattern)) {
        const entry = await lstat(file);
        if (entry.isFile()) {
          paths.push(file)
        }
      }
    } else {
      const { sep } = await import(nodePath);
      for await (const entry of (await fs).glob(pattern, { withFileTypes: true })) {
        if (entry.isFile()) {
          const path = entry.parentPath + sep + entry.name;
          const relativeToProjectRoot = path.slice(process.cwd().length + 1);
          paths.push(relativeToProjectRoot);
        }
      }
    }
    return paths.sort();
  } else {
    return vscodeExtensionFs.findFiles(pattern);
  }
};

/**
 * Read all files from the local filesystem that match the supplied glob pattern, (via `findFiles`)
 * and parse then as JSON. Filepath is in `path`, filename without suffix in `slug`.
 *
 * The default TypeScript type for the data is `unknown`. You can override that with e.g.
 * `readJsonFiles<{ title: string }>("data/*.json")`. But to actually verify the metadata is
 * correct, you should use a schema. For example using
 * [validate.js](https://github.com/jakelazaroff/validate.js):
 *
 * ```ts
 * import { object, string } from "./validate.js";
 * const schema = object({ title: string });
 * const arr = await readJsonFiles(pattern, { schema }),
 * ```
 */
export const readJsonFiles = async <T>(
  pattern: string,
  opts: { schema?: StandardSchemaV1<unknown, T> } = {},
): Promise<Array<{ data: T; path: string; slug: string }>> =>
  Promise.all(
    (await findFiles(pattern)).map(async (path) => {
      let data = JSON.parse(await readTextFile(path));
      if (opts.schema) {
        const res = await opts.schema["~standard"].validate(data);
        if (res.issues) {
          const issues = res.issues.map((i) => `${i.message} (${i.path})`);
          throw Error(`JSON in ${path} did not validate:\n  ${issues.join("\n  ")}`);
        }
        data = res.value;
      }
      const slug = path.split(sep).at(-1)?.split(".").at(0) || "";
      return { data, path, slug };
    }),
  );


/**
 * Best-effort input validation for unix paths
 */
const validatePattern = (p: string) => {
  p = p.startsWith("/") ? p.slice(1) : p;
  if (p.startsWith("../") || p.includes("/../")) {
    throw Error("findFiles pattern must not include ../");
  }
  return p;
}

const leadingSlash = (path: string) =>
  path.startsWith("/") ? path : "/" + path;

/**
 * File path separator. `\` on Windows, `/` otherwise.
 */
export const sep: string = typeof document === "object" ? "/" : (await import(nodePath)).sep;

const noLeadingSep = (path: string) =>
  path.startsWith(sep) ? path.slice(1) : path;
