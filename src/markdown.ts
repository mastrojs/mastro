import type { Options } from "npm:micromark@4.0.2";

const importPrefix = typeof document === "object" ? "https://esm.sh/" : "npm:";
const jsYaml = await import(`${importPrefix}js-yaml@4.1.0`);
const { micromark } = await import(`${importPrefix}micromark@4.0.2`);
const { gfm, gfmHtml } = await import(`${importPrefix}micromark-extension-gfm@3.0.0`);

import { findFiles, readTextFile } from "./fs.ts";
import { type Html, unsafeInnerHtml } from "./html.ts";

// from https://github.com/dworthen/js-yaml-front-matter/blob/master/src/index.js#L14
const yamlFrontRe = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/

interface Md {
  content: Html;
  meta: Record<string, string>;
}

/**
 * Convert a markdown string (GFM, with YAML metadata) to an `Html` node
 * and an object for the metadata.
 */
export const markdownToHtml = (md: string, opts?: Options): Md => {
  const { bodyMd, meta } = parseYamlFrontmatter(md)
  const content = unsafeInnerHtml(
    micromark(bodyMd, {
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
): Promise<Array<Md & {path: string}>> => {
  const paths = await findFiles(pattern);
  const files = await Promise.all( paths.map(readTextFile) );
  return files.map((file, i) => ({ path: paths[i], ...markdownToHtml(file, opts)}));
}

const parseYamlFrontmatter = (md: string) => {
  let meta = {}
  let bodyMd = md
  const results = yamlFrontRe.exec(md)
  try {
    const yaml = results?.[2]
    if (yaml) {
      const metaObj = jsYaml.load(yaml, { schema: jsYaml.JSON_SCHEMA })
      if (typeof metaObj === 'object' && !(metaObj instanceof Array) ) {
        bodyMd = results?.[3] || ''
        meta = metaObj
      }
    }
  } catch(e) {
    console.warn("Could not parse YAML", (e as Error).message)
  }
  return { bodyMd, meta }
}
