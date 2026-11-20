/**
 * Internal branded type of a decoded, project-relative filesystem path.
 */
export type FilePath = string & { readonly __filePath: unique symbol };

/**
 * Convert a URL path to a decoded, project-relative filesystem path with forward slashes
 * on every platform. For example `urlPathToFilePath("/foo/bar%20baz.jpg") === "foo/bar baz.jpg"`
 */
export const urlPathToFilePath = (urlPath: string & { readonly __filePath?: never }): FilePath => {
  const path = normalizeSlashes(decodeURIComponent(urlPath)).replace(/^\/+/, "");
  if (path.split("/").includes("..")) throw Error("FilePath must not include .. segments");
  // on Windows, prevent paths starting with `C:`, `./C:`, etc:
  if (sep === "\\" && /^(?:\.\/+)*[a-z]:/i.test(path)) throw Error("FilePath must be relative");
  return (path || ".") as FilePath; // urlPathToFilePath("/") === "."
};

/** Replace backslashes with forward slashes on Windows */
export const normalizeSlashes = (path: string): string =>
  sep === "\\" ? path.replaceAll("\\", "/") : path;

/** Backslash on Windows, forward slash everywhere else */
export const sep: "/" | "\\" =
  typeof process !== "undefined" && process.platform === "win32" ? "\\" : "/";
