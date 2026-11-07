/**
 * Lightweight wrapper around Node.js's file system functions. But for better interoperability
 * with URL paths, input and output paths use URL encoding.
 * Using RPC for the [vscode-extension](../../vscode-extension/README.md).
 * Cloudflare Workers work with Node.js compatibility.
 * For Service Workers (where there is no filesystem), we fall back to undefined
 * and skip Node.js imports so the module can still load.
 */
import type { StandardSchemaV1 } from "./standard-schema.d.ts";

import { isWorker, normalizeSlashes, sep, urlPathToFilePath } from "./fsHelpers.ts";

// In a variable to prevent bundling by esbuild:
const nodeFs = "node:fs/promises";

const fs = typeof document === "object" || isWorker
  ? undefined
  : import(nodeFs) as Promise<typeof import("node:fs/promises")>;

const vscodeExtensionFs = typeof document === "object"
  ? (document as any).fs
    : (isWorker ? (self as any).fs : undefined);

/**
 * Read the directory on the local file system and return its files,
 * non-recursive and ignoring symlinks and dotfiles.
 *
 * Input is a URL path relative to project root. Returned filenames are URL-encoded.
 */
export const readDir = async (path: string): Promise<string[]> => {
  const files: string[] = await (fs
    ? (await fs).readdir(urlPathToFilePath(path), { withFileTypes: true })
      .then((files) =>
        files.flatMap((file) =>
          file.isSymbolicLink() || file.isDirectory() || file.name[0] === "." ? [] : file.name
        )
      )
    : vscodeExtensionFs.readDir(urlPathToFilePath(path)));
  return files.map(toUrlPath);
};

/**
 * Return the contents of a text file on the local file system as a string.
 *
 * Input is a URL path relative to project root.
 */
export const readTextFile = async (path: string): Promise<string> =>
  fs
    ? (await fs).readFile(urlPathToFilePath(path), { encoding: "utf8" })
    : vscodeExtensionFs.readTextFile(urlPathToFilePath(path));

/**
 * Return the contents of a binary file on the local file system.
 *
 * Input is a URL path relative to project root.
 */
export const readFile = async (path: string): Promise<Uint8Array<ArrayBufferLike>> =>
  fs
    ? (await fs).readFile(urlPathToFilePath(path))
    : vscodeExtensionFs.readFile((urlPathToFilePath(path)));

/**
 * Return the file paths on the local file system, relative to the current working directory,
 * expanding glob patterns like `*` and `**`. Do not pass it untrusted input.
 *
 * Returned paths are sorted alphabetically, are URL-encoded, use forward slashes,
 * and don't start with a slash. Input glob patterns use filesystem names, not URL encoding.
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
        const relativeToCwd = (entry.parentPath + sep + entry.name).slice(process.cwd().length + 1);
        paths.push(toUrlPath(relativeToCwd));
      }
    }
    return paths.sort();
  } else {
    return ((await vscodeExtensionFs.findFiles(pattern)) as string[]).map(toUrlPath).sort();
  }
};

/**
 * Read all files from the local filesystem that match the supplied glob pattern (via `findFiles`)
 * and parse them as JSON. Returns an array with `data`, `path` as a URL path, and `slug` as the
 * URL-encoded filename up to its first dot (e.g. `post.en.json` becomes `post`).
 *
 * The default TypeScript type for the data is `unknown`. You can override that with e.g.
 * `readJsonFiles<{ title: string }>("data/*.json")`. But to actually verify the metadata is
 * correct, you should use a schema. For example using
 * [validate.js](https://github.com/jakelazaroff/validate.js):
 *
 * ```ts
 * import { object, string } from "./validate.js";
 * const schema = object({ title: string });
 * const arr = await readJsonFiles(pattern, { schema });
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

// normalize and convert a filesystem path to a URL path
const toUrlPath = (path: string): string =>
  normalizeSlashes(path).split("/").map(encodeURIComponent).join("/");
