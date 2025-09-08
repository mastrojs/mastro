const fs = typeof document === "object"
  ? undefined
  : await import("node:fs/promises");

// we use document.fs because dnt would add a shim for window https://github.com/denoland/dnt/issues/454
const vscodeExtensionFs = typeof document === "object"
  // deno-lint-ignore no-explicit-any
  ? (document as any).fs
  : undefined;

/**
 * Path separator: `\` on Windows, `/` everywhere else.
 */
export const sep: "/" | "\\" = typeof document === "object" ? "/" : (await import("@std/path")).SEPARATOR;

/**
 * Read the directory on the local file system and return its files,
 * non-recursive and ignoring symlinks.
 */
export const readDir = (path: string): Promise<string[]> =>
  fs
    ? fs.readdir(noLeadingSep(path), { withFileTypes: true })
      .then((files) =>
        files.flatMap((file) =>
          file.isSymbolicLink() || file.isDirectory() ? [] : file.name
        )
      )
    : vscodeExtensionFs.readDir(leadingSep(path));

/**
 * Return the contents of a text file on the local file system as a string.
 */
export const readTextFile = (path: string): Promise<string> =>
  fs
    ? fs.readFile(noLeadingSep(path), { encoding: "utf8" })
    : vscodeExtensionFs.readTextFile(leadingSep(path));

/**
 * Return the file paths on the local file system,
 * expanding glob patterns like `*` and `**`.
 *
 * Supported patterns depend on the platform:
 *
 * - [Deno](https://jsr.io/@std/fs/doc/expand-glob/~/expandGlob)
 * - [VSCode for the Web](https://code.visualstudio.com/api/references/vscode-api#GlobPattern)
 *   (although currently [broken](https://github.com/microsoft/vscode/issues/249197))
 */
export const findFiles = async (pattern: string): Promise<string[]> => {
  pattern = pattern.startsWith("/") ? pattern.slice(1) : pattern;
  if (typeof document === "object") {
    return vscodeExtensionFs.findFiles(pattern);
  } else {
    // TODO: perhaps switch to https://nodejs.org/api/fs.html#fspromisesglobpattern-options
    const { expandGlob } = await import("@std/fs");
    const paths = [];
    for await (const file of expandGlob(pattern)) {
      if (file.isFile && !file.isSymlink && !file.path.endsWith("/.DS_Store")) {
        const relativeToProjectRoot = file.path.slice(Deno.cwd().length);
        paths.push(relativeToProjectRoot);
      }
    }
    return paths;
  }
};

const leadingSep = (path: string) =>
  path.startsWith(sep) ? path : "/" + path;
const noLeadingSep = (path: string) =>
  path.startsWith(sep) ? path.slice(1) : path;
