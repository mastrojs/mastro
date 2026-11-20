/**
 * Module with helper function to generate HTML from markdown.
 * By default, it uses `micromark` with `micromark-extension-gfm`.
 * @module
 */

import { sep } from "node:path";

import { findFiles, type Html, readTextFile, unsafeInnerHtml } from "@mastrojs/mastro";
import { parse } from "yaml";
import { micromark, type Options } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import type { StandardSchemaV1 } from "./standard-schema.ts";

export type { Options };

/**
 * Return type containing the generated HTML and the YAML metadata.
 */
export interface Md<M extends DefaultM = DefaultM> {
  content: Html;
  meta: M;
}

/**
 * [Micromark options](https://github.com/micromark/micromark/blob/main/packages/micromark/readme.md#options)
 * or a custom markdown-to-HTML function to be used instead of the default `micromark` with GFM.
 */
export type Parse = Options | ((md: string) => string | Promise<string>);

/**
 * A [Standard Schema](https://standardschema.dev/) to validate YAML frontmatter metadata
 */
export type MetaSchema<M> = StandardSchemaV1<unknown, M>;

/**
 * If no schema is provided, we fall back to this type for the metadata.
 *
 * We use `unknown` instead of `string | number | boolean | Date | null | undefined>`
 * because you could have deeply nested objects or arrays.
 */
export type DefaultM = Record<string, unknown>;

/**
 * Convert a markdown string (incl. YAML frontmatter metadata) to an `Html` node
 * and an object for the metadata. Like the other exported functions, it optionally takes a
 * `schema`, and a `mdToHtml` function to use instead of the default micromark with GFM.
 */
export const markdownToHtml = <M extends DefaultM = DefaultM>(
  md: string,
  opts?: { parse?: Parse; schema?: MetaSchema<M> },
): Promise<Md<M>> => parseMd(md, opts);

/**
 * Convert a markdown string with no YAML frontmatter to an `Html` node
 */
export const markdownPlainToHtml = (md: string, opts?: Parse): Html =>
  unsafeInnerHtml(micromark(md, { extensions: [gfm()], htmlExtensions: [gfmHtml()], ...opts }));

/**
 * Read a file from the local filesystem and convert its markdown contents
 * to an `Html` node and an object for the metadata.
 */
export const readMarkdownFile = async <M extends DefaultM = DefaultM>(
  path: string,
  opts?: { parse?: Parse; schema?: MetaSchema<M> },
): Promise<Md<M>> => parseMd(await readTextFile(path), opts, path);

/**
 * Read all files from the local filesystem that match the supplied glob pattern, (via `findFiles`)
 * and convert their markdown contents to `Html` nodes and objects for their metadata.
 * Filepath is in `path`, filename without suffix in `slug`.
 */
export const readMarkdownFiles = async <M extends DefaultM = DefaultM>(
  pattern: string,
  opts?: { parse?: Parse; schema?: MetaSchema<M> },
): Promise<Array<Md<M> & { path: string, slug: string; }>> => {
  const paths = await findFiles(pattern);
  return Promise.all(
    paths.map(async (path) => {
      const file = await readTextFile(path);
      const md = await parseMd(file, opts, path);
      const slug = path.split(sep).at(-1)?.split(".").at(0) || "";
      return { ...md, path, slug };
    }),
  );
};

/**
 * Serve a folder on the local filesystem containing potentially deeply nested markdown files,
 * and convert them to `Html` and metadata.
 *
 * Place the following in e.g. `routes/[...slug].server.js`
 *
 * ```ts
 * import { serveMarkdownFolder } from "@mastrojs/markdown";
 * import { html, htmlToResponse } from "@mastrojs/mastro";
 *
 * export const { GET, getStaticPaths } = serveMarkdownFolder(
 *   {
 *     folder: "data",
 *   },
 *   ({ content, meta }, req) => {
 *     return htmlToResponse(html`
 *       <!DOCTYPE html>
 *       <title>${meta.title}</title>
 *       <main>${content}</main>
 *     `);
 *   }
 * }
 * ```
 *
 * Then, make sure to access the route with URLs having a trailing slash.
 *
 * With the above example, the URL `/blog/hello-world/` will read out the file
 * `data/blog/hello-world.md`, and the URL `/` will read out the file `data/index.md`.
 */
export const serveMarkdownFolder = <M extends DefaultM = DefaultM>(
  opts: { folder: string; parse?: Parse; schema?: MetaSchema<M> },
  renderFn: (convertedMd: Md<M>, req: Request) => Promise<Response> | Response,
): {
  GET: (req: Request) => Promise<Response>;
  getStaticPaths: () => Promise<string[]>;
} => {
  const { folder } = opts;

  const GET = async (req: Request) => {
    let { pathname } = new URL(req.url);
    if (!pathname.endsWith("/")) {
      const err = Error("NotFound: path must end with a /");
      err.name = "NotFound";
      throw err;
    }
    pathname = pathname.slice(0, -1);
    pathname = pathname.startsWith("/") ? pathname : "/" + pathname;
    let filePath = folder + pathname + ".md";
    let txt;
    try {
      txt = await readTextFile(filePath);
    } catch (e: unknown) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        filePath = folder + pathname + "/index.md";
        txt = await readTextFile(filePath);
      } else {
        throw e;
      }
    }
    const converted = await parseMd(txt, opts, filePath);
    return renderFn(converted, req);
  };

  const getStaticPaths = async () => {
    const files = await findFiles(folder + "/**/*.md");
    const l = folder.length;
    return files.map((file) =>
      file.endsWith("/index.md") ? file.slice(l, -8) : file.slice(l, -3) + "/"
    );
  };

  return { GET, getStaticPaths };
};

const parseMd = async <M extends DefaultM = DefaultM>(
  md: string,
  opts?: { parse?: Parse; schema?: MetaSchema<M> },
  filePath?: string,
) => {
  const { parse, schema } = opts || {};
  const { body, meta } = await parseYamlFrontmatter(md, schema, filePath);
  const content = typeof parse === "function"
    ? unsafeInnerHtml(await parse(body))
    : markdownPlainToHtml(body, parse);
  return { content, meta };
};

/**
 * Converts a string possibly containing yaml frontmatter to a `{ meta, body }` object.
 *
 * - `meta` is an object with the parsed yaml.
 * - `body` is a string with the rest of the input.
 */
const parseYamlFrontmatter = async <M extends DefaultM>(
  md: string,
  schema?: MetaSchema<M>,
  filePath?: string,
): Promise<{ body: string; meta: M }> => {
  let meta = {} as M;
  let body = md;
  const results = yamlFrontRe.exec(md);
  try {
    const yaml = results?.[2];
    if (yaml) {
      const metaObj = parse(yaml, { schema: "core" });
      if (metaObj && typeof metaObj === "object" && !(metaObj instanceof Array)) {
        body = results?.[3] || "";
        meta = metaObj as M;
      }
    }
  } catch (e) {
    const msg = `Could not parse YAML in ${filePath}: ${e}`;
    if (schema) {
      throw Error(msg, { cause: e });
    } else {
      console.warn(msg);
    }
  }

  if (schema) {
    const res = await schema["~standard"].validate(meta);
    if (res.issues) {
      const issues = res.issues.map((i) => `${i.message} (${i.path})`);
      throw Error(`YAML in ${filePath} did not validate:\n  ${issues.join("\n  ")}`);
    }
    meta = res.value;
  }
  return { meta, body };
};

// from https://github.com/dworthen/js-yaml-front-matter/blob/master/src/index.js#L14
const yamlFrontRe = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/;
