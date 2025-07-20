import type { Options } from "npm:micromark@4.0.2";
import { findFiles, readTextFile } from "./fs.ts";
import { type Html, unsafeInnerHtml } from "./html.ts";

const importLazy = (pkg: string) =>
  import(typeof document === "object" ? `https://esm.sh/${pkg}?bundle` : `npm:${pkg}`);

// from https://github.com/dworthen/js-yaml-front-matter/blob/master/src/index.js#L14
const yamlFrontRe = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/;

interface Md {
  content: Html;
  meta: Record<string, string>;
}

/**
 * Convert a markdown string (GFM, with YAML metadata) to an `Html` node
 * and an object for the metadata.
 * `micromark` is used to parse GFM with YAML frontmatter.
 */
export const markdownToHtml = async (md: string, opts?: Options): Promise<Md> => {
  const [{ body, meta }, { micromark }, { gfm, gfmHtml }] = await Promise.all([
    parseYamlFrontmatter(md),
    importLazy("micromark@4.0.2"),
    importLazy("micromark-extension-gfm@3.0.0"),
  ]);
  const content = unsafeInnerHtml(
    micromark(body, {
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()],
      ...opts,
    }),
  );
  return { content, meta };
};

/**
 * Read a file from the local filesystem and convert its markdown contents
 * to an `Html` node and an object for the metadata.
 *
 * Unless a `mdToHtml` function is passed, `micromark` is used to parse GFM with YAML frontmatter.
 */
export const readMarkdownFile = async (
  path: string,
  mdToHtml: (md: string) => Promise<Md> = markdownToHtml,
): Promise<Md> => mdToHtml(await readTextFile(path));

/**
 * Read all files from the local filesystem that match the supplied glob pattern,
 * (via `findFiles`) and convert their markdown contents to `Html` nodes and objects for their metadata.
 *
 * Unless a `mdToHtml` function is passed, `micromark` is used to parse GFM with YAML frontmatter.
 */
export const readMarkdownFiles = async (
  pattern: string,
  mdToHtml: (md: string) => Promise<Md> = markdownToHtml,
): Promise<Array<Md & { path: string }>> => {
  const paths = await findFiles(pattern);
  return Promise.all(
    paths.map(async (path, i) => {
      const file = await readTextFile(path);
      const md = await mdToHtml(file);
      return { path: paths[i], ...md };
    }),
  );
};

/**
 * Read a nested file from a `folder` on the local filesystem and
 * convert its markdown contents to an `Html` node and an object for the metadata.
 *
 * ```js
 * readMarkdownFileInFolder("data", "/guide/hello-world/"); // reads data/guide/hello-world.md
 * readMarkdownFileInFolder("data", "/"); // reads data/index.md
 * ```
 *
 * Unless a `mdToHtml` function is passed, `micromark` is used to parse GFM with YAML frontmatter.
 */
export const readMarkdownFileInFolder = async (
  folder: string,
  path: string,
  mdToHtml: (md: string) => Promise<Md> = markdownToHtml,
): Promise<Md> => {
  path = path.startsWith("/") ? path : "/" + path;
  path = path.endsWith("/") ? path.slice(0, -1) : path;
  let txt;
  try {
    txt = await readTextFile(folder + path + ".md");
  } catch {
    txt = await readTextFile(folder + path + "/index.md");
  }
  return mdToHtml(txt);
};

/**
 * Converts a string possibly containing yaml frontmatter to a `{ meta, body }` object.
 *
 * - `meta` is an object with the parsed yaml.
 * - `body` is a string with the rest of the input.
 */
export const parseYamlFrontmatter = async (
  md: string,
): Promise<{ body: string; meta: Record<string, string>}> => {
  let meta = {};
  let body = md;
  const results = yamlFrontRe.exec(md);
  try {
    const yaml = results?.[2];
    if (yaml) {
      const jsYaml = await importLazy("js-yaml@4.1.0");
      const metaObj = jsYaml.load(yaml, { schema: jsYaml.JSON_SCHEMA });
      if (typeof metaObj === "object" && !(metaObj instanceof Array)) {
        body = results?.[3] || "";
        meta = metaObj;
      }
    }
  } catch (e) {
    console.warn("Could not parse YAML", (e as Error).message);
  }
  return { body, meta };
};
