/**
 * Lightweight wrapper around Node.js's file system functions and using RPC for the
 * [vscode-extension](../../vscode-extension/README.md).
 * Cloudflare Workers work with Node.js compatibility.
 * For Service Workers (where there is no filesystem), we fall back to undefined
 * and skip Node.js imports so the module can still load.
 */
import type { StandardSchemaV1 } from "./standard-schema.d.ts";

/** A decoded project-relative filesystem path, with forward slashes on every platform. */
export type FilePath = string & { readonly __filePath: unique symbol };

/** Convert a URL path to a project-relative filesystem path, stripping leading slashes and rejecting .. segments. */
export const filePath = (urlPath: string & { readonly __filePath?: never }): FilePath => {
  const path = normalizeSlashes(decodeURIComponent(urlPath)).replace(/^\/+/, "");
  if (path.split("/").includes("..")) throw Error("File paths must not include .. segments");
  // on Windows, prevent paths starting like `C:` and `./C:`
  if (sep === "\\" && /^(?:\.\/+)*[a-z]:/i.test(path)) throw Error("File paths must be relative");
  return (path || ".") as FilePath;
};

/** Encode a filesystem path for use as a URL path, preserving directory slashes. */
export const urlPath = (path: FilePath): string =>
  path.split("/").map(encodeURIComponent).join("/");

// in variables to prevent bundling by esbuild:
const nodeFs = "node:fs/promises";
const nodePath = "node:path";

// @ts-expect-error WorkerGlobalScope
const isWorker = typeof self !== "undefined" && self.WorkerGlobalScope && navigator.userAgent !== "Cloudflare-Workers";

const fs = typeof document === "object" || isWorker
  ? undefined
  : import(nodeFs) as Promise<typeof import("node:fs/promises")>;

const { sep = "/" } = typeof document === "object" || isWorker
  ? {}
  : await import(nodePath) as typeof import("node:path");

// we use document.fs because dnt would add a shim for window https://github.com/denoland/dnt/issues/454
const vscodeExtensionFs = typeof document === "object"
  ? (document as any).fs
    : (isWorker ? (self as any).fs : undefined);

/**
 * Read the directory on the local file system and return its files,
 * non-recursive and ignoring symlinks.
 *
 * Input is a URL path relative to project root. Returned filenames are URL-encoded.
 */
export const readDir = async (path: string): Promise<string[]> => {
  const files: string[] = await (fs
    ? (await fs).readdir(filePath(path), { withFileTypes: true })
      .then((files) =>
        files.flatMap((file) =>
          file.isSymbolicLink() || file.isDirectory() || file.name[0] === "." ? [] : file.name
        )
      )
    : vscodeExtensionFs.readDir(leadingSlash(filePath(path))));
  return files.map((name) => urlPath(normalizeSlashes(name)));
};

/**
 * Return the contents of a text file on the local file system as a string.
 *
 * Input is a URL path relative to project root, decoded once before reading.
 */
export const readTextFile = async (path: string): Promise<string> =>
  fs
    ? (await fs).readFile(filePath(path), { encoding: "utf8" })
    : vscodeExtensionFs.readTextFile(leadingSlash(filePath(path)));

/**
 * Return the contents of a binary file on the local file system.
 *
 * Input is a URL path relative to project root, decoded once before reading.
 */
export const readFile = async (path: string): Promise<Uint8Array<ArrayBufferLike>> =>
  fs
    ? (await fs).readFile(filePath(path))
    : vscodeExtensionFs.readFile(leadingSlash(filePath(path)));

/**
 * Return the file paths on the local file system, relative to the current working directory,
 * expanding glob patterns like `*` and `**`. Do not pass it untrusted input.
 *
 * Returned URL paths are encoded, use forward slashes, are sorted alphabetically
 * and don't start with a slash. Glob patterns use filesystem names, not URL encoding.
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
    const paths: string[] = [];
    for await (const entry of (await fs).glob(pattern, { withFileTypes: true })) {
      if (entry.isFile()) {
        const path = entry.parentPath + sep + entry.name;
        const relativeToProjectRoot = path.slice(process.cwd().length + 1);
        paths.push(urlPath(normalizeSlashes(relativeToProjectRoot)));
      }
    }
    return paths.sort();
  } else {
    return ((await vscodeExtensionFs.findFiles(pattern)) as string[])
      .map((path) => urlPath(normalizeSlashes(path))).sort();
  }
};

/**
 * Read all files from the local filesystem that match the supplied glob pattern, (via `findFiles`)
 * and parse then as JSON. URL path is in `path`, URL-encoded filename without suffix in `slug`.
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
      const slug = path.split("/").at(-1)?.split(".").at(0) || "";
      return { data, path, slug };
    }),
  );


/**
 * Best-effort input validation for unix paths
 */
const validatePattern = (p: string) => {
  p = p.startsWith("/") ? p.slice(1) : p;
  if (p.split("/").includes("..")) throw Error("findFiles pattern must not include .. segments");
  return p;
}

const leadingSlash = (path: string) =>
  path.startsWith("/") ? path : "/" + path;

// Replace backslashes with forward slashes on Windows.
const normalizeSlashes = (path: string): FilePath =>
  (sep === "\\" ? path.replaceAll("\\", "/") : path) as FilePath;
