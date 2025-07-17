import type { Options } from "npm:micromark@4.0.2";
import { findFiles, readTextFile } from "./fs.ts";
import { type Html, unsafeInnerHtml } from "./html.ts";

const importLazy = (pkg: string) =>
  import(typeof document === "object" ? `https://esm.sh/${pkg}?bundle` : `npm:${pkg}`)

// from https://github.com/dworthen/js-yaml-front-matter/blob/master/src/index.js#L14
const yamlFrontRe = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/;

interface Md {
  content: Html;
  meta: Record<string, string>;
}

/**
 * Convert a markdown string (GFM, with YAML metadata) to an `Html` node
 * and an object for the metadata.
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
 * (GFM, with YAML metadata) to an `Html` node and an object for the metadata.
 */
export const readMarkdownFile = async (path: string, opts?: Options): Promise<Md> =>
  markdownToHtml(await readTextFile(path), opts);

/**
 * Read all files from the local filesystem that match the supplied glob pattern,
 * (via `findFiles`) and convert their markdown contents (GFM, with YAML metadata)
 * to `Html` nodes and objects for their metadata.
 */
export const readMarkdownFiles = async (
  pattern: string,
  opts?: Options,
): Promise<Array<Md & { path: string }>> => {
  const paths = await findFiles(pattern);
  return Promise.all(
    paths.map(async (path, i) => {
      const file = await readTextFile(path);
      const md = await markdownToHtml(file, opts);
      return { path: paths[i], ...md };
    }),
  );
};

/**
 * Converts a string possibly containing yaml frontmatter to a `{ meta, body }` object.
 *
 * - `meta` is an object with the parsed yaml.
 * - `body` is a string with the rest of the input.
 */
export const parseYamlFrontmatter = async (md: string) => {
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
