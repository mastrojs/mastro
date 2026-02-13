const fs = typeof document === "object"
  ? undefined
  : await import("node:fs/promises");

// we use document.fs because dnt would add a shim for window https://github.com/denoland/dnt/issues/454
const vscodeExtensionFs = typeof document === "object"
  ? (document as any).fs
  : undefined;

/**
 * Path separator: `\` on Windows, `/` everywhere else.
 */
export const sep: "/" | "\\" = typeof document === "object" ? "/" : (await import("node:path")).sep;

/**
 * Read the directory on the local file system and return its files,
 * non-recursive and ignoring symlinks.
 *
 * Input path needs to be relative to project root.
 */
export const readDir = (path: string): Promise<string[]> =>
  fs
    ? fs.readdir(noLeadingSep(path), { withFileTypes: true })
      .then((files) =>
        files.flatMap((file) =>
          file.isSymbolicLink() || file.isDirectory() || file.name[0] === "." ? [] : file.name
        )
      )
    : vscodeExtensionFs.readDir(leadingSep(path));

/**
 * Return the contents of a text file on the local file system as a string.
 *
 * Input path needs to be relative to project root.
 */
export const readTextFile = (path: string): Promise<string> =>
  fs
    ? fs.readFile(noLeadingSep(path), { encoding: "utf8" })
    : vscodeExtensionFs.readTextFile(leadingSep(path));

/**
 * Return the contents of a binary file on the local file system.
 *
 * Input path needs to be relative to project root.
 */
export const readFile = (path: string): Promise<Uint8Array<ArrayBufferLike>> =>
  fs
    ? fs.readFile(noLeadingSep(path))
    : vscodeExtensionFs.readFile(leadingSep(path));

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
      for await (const file of fs.glob(pattern)) {
        const entry = await fs.lstat(file);
        if (entry.isFile()) {
          paths.push(file)
        }
      }
    } else {
      for await (const entry of fs.glob(pattern, { withFileTypes: true })) {
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

const leadingSep = (path: string) =>
  path.startsWith(sep) ? path : "/" + path;
const noLeadingSep = (path: string) =>
  path.startsWith(sep) ? path.slice(1) : path;
