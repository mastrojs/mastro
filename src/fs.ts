const fs = typeof document === "object"
  ? undefined
  : await import("node:fs/promises");

// we use document.fs because dnt would add a shim for window https://github.com/denoland/dnt/issues/454
const vscodeExtensionFs = typeof document === "object"
  // deno-lint-ignore no-explicit-any
  ? (document as any).fs
  : undefined;

/**
 * Reads the directory and lists its files non-recursively and ignoring symlinks.
 */
export const readDir = (path: string): Promise<string[]> =>
  fs
    ? fs.readdir(ensureNoLeadingSlash(path), { withFileTypes: true })
      .then((files) =>
        files.flatMap((file) =>
          file.isSymbolicLink() || file.isDirectory() ? [] : file.name
        )
      )
    : vscodeExtensionFs.readDir(ensureLeadingSlash(path));

export const readTextFile = (path: string): Promise<string> =>
  fs
    ? fs.readFile(ensureNoLeadingSlash(path), { encoding: "utf8" })
    : vscodeExtensionFs.readTextFile(ensureLeadingSlash(path));

/**
 * Expands glob patterns like `*` and `**` and returns the matching file paths.
 *
 * Patterns supported currently depends on platform:
 *
 * - VSCode for the Web: [Glob Pattern](https://code.visualstudio.com/api/references/vscode-api#GlobPattern)
 * - Deno: [expandGlob](https://jsr.io/@std/fs/doc/expand-glob/~/expandGlob)
 */
export const findFiles = async (pattern: string): Promise<string[]> => {
  pattern = pattern.startsWith("/") ? pattern.slice(1) : pattern;
  if (typeof document === "object") {
    return vscodeExtensionFs.findFiles(pattern);
  } else {
    const { expandGlob } = await import("@std/fs");
    const paths = [];
    for await (const file of expandGlob(pattern)) {
      if (file.isFile && !file.isSymlink) {
        const relativeToProjectRoot = file.path.slice(Deno.cwd().length);
        paths.push(relativeToProjectRoot);
      }
    }
    return paths;
  }
};

const ensureLeadingSlash = (path: string) =>
  path.startsWith("/") ? path : "/" + path;
const ensureNoLeadingSlash = (path: string) =>
  path.startsWith("/") ? path.slice(1) : path;
