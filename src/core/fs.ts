/**
 * Lightweight wrapper around Node.js's file system functions and using RPC for the
 * [vscode-extension](../../vscode-extension/README.md).
 * Cloudflare Workers work with Node.js compatibility.
 * For Service Workers (where there is no filesystem), we just fall back to undefined, but at least
 * we don't want to break the module, hence no top-level await.
 */

// in variables to prevent bundling by esbuild:
const nodeFs = "node:fs/promises";
const nodePath = "node:path";

// @ts-expect-error WorkerGlobalScope
const isWorker = typeof self !== "undefined" && self.WorkerGlobalScope;

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
    ? (await fs).readFile(await noLeadingSep(path), { encoding: "utf8" })
    : vscodeExtensionFs.readTextFile(leadingSlash(path));

/**
 * Return the contents of a binary file on the local file system.
 *
 * Input path needs to be relative to project root.
 */
export const readFile = async (path: string): Promise<Uint8Array<ArrayBufferLike>> =>
  fs
    ? (await fs).readFile(await noLeadingSep(path))
    : vscodeExtensionFs.readFile(leadingSlash(path));

/**
 * Return the file paths on the local file system, relative to the current working directory,
 * expanding glob patterns like `*` and `**`. Do not pass it untrusted input.
 *
 * Returned paths don't start with a slash (or other path separator).
 *
 * Except for when using the Mastro VSCode extension, this is a thin wrapper around
 * [fs.glob](https://nodejs.org/api/fs.html#fspromisesglobpattern-options).
 *
 * In [VSCode for the Web](https://code.visualstudio.com/api/references/vscode-api#GlobPattern)
 * there is a [bug](https://github.com/microsoft/vscode/issues/249197) and we had to roll our own.
 */
export const findFiles = async (pattern: string): Promise<string[]> => {
  // best-effort input validation for unix paths
  pattern = pattern.startsWith("/") ? pattern.slice(1) : pattern;
  if (pattern.startsWith("../") || pattern.includes("/../")) {
    throw Error("findFiles pattern must not include ../");
  }
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
    return paths;
  } else {
    return vscodeExtensionFs.findFiles(pattern);
  }
};

const leadingSlash = (path: string) =>
  path.startsWith("/") ? path : "/" + path;

const noLeadingSep = async (path: string) => {
  const sep: string = typeof document === "object" ? "/" : (await import(nodePath)).sep;
  return path.startsWith(sep) ? path.slice(1) : path;
}
