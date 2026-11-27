/**
 * Module with helper function to generate HTML from markdown.
 * By default, it uses `micromark` with `micromark-extension-gfm`.
 * @module
 */

import { findFiles, type Html, readTextFile, unsafeInnerHtml } from "@mastrojs/mastro";
import { micromark, type Options } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { parse } from "yaml";

import type { StandardSchemaV1 } from "./standard-schema.ts";

export type { Options };

/**
 * Return type containing the generated HTML in `content`, and the YAML metadata in `meta`.
 */
export interface Md<M extends DefaultM = DefaultM> {
  /** `Html` node */
  content: Html;
  /** YAML frontmatter metadata object */
  readonly meta: Readonly<M>;
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
 * We use `unknown` instead of `string | number | boolean | Date | null | undefined`
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
export const markdownPlainToHtml = (md: string, opts?: Options): Html =>
  unsafeInnerHtml(micromark(md, { extensions: [gfm()], htmlExtensions: [gfmHtml()], ...opts }));

/**
 * Read a file from the local filesystem and convert its markdown contents
 * to an `Html` node and an object for the metadata.
 */
export const readMarkdownFile = async <M extends DefaultM = DefaultM>(
  path: string,
  opts?: { parse?: Parse; schema?: MetaSchema<M>; disableCache?: boolean },
): Promise<Md<M>> => parseMd({ path }, opts);

interface PathAndSlug {
  /** Full URL path */
  path: string;
  /** URL-encoded filename up to its first dot: e.g. `blog/post.en.json` has the slug `post` */
  slug: string;
}
/**
 * Read all files from the local filesystem that match the supplied glob pattern, (via `findFiles`)
 * and convert their markdown contents.
 * Returns an array of objects with `content`, `meta`, `path` and `slug`.
 */
export const readMarkdownFiles = async <M extends DefaultM = DefaultM>(
  pattern: string,
  opts?: { parse?: Parse; schema?: MetaSchema<M>; disableCache?: boolean },
): Promise<Array<Md<M> & PathAndSlug>> => {
  const paths = await findFiles(pattern);
  return Promise.all(
    paths.map(async (path) => {
      const md = await readMarkdownFile(path, opts);
      const slug = path.split("/").at(-1)?.split(".").at(0) || "";
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
  opts: { folder: string; parse?: Parse; schema?: MetaSchema<M>; disableCache?: boolean },
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
    let converted: Md<M>;
    try {
      converted = await readMarkdownFile(folder + pathname + ".md", opts);
    } catch (e: unknown) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        converted = await readMarkdownFile(folder + pathname + "/index.md", opts);
      } else {
        throw e;
      }
    }
    return renderFn(converted, req);
  };

  const getStaticPaths = async () => {
    const files = await findFiles(folder + "/**/*.md");
    const l = folder.length;
    return files.map((file) =>
      file.endsWith("/index.md") ? file.slice(l, -8) : file.slice(l, -3) + "/",
    );
  };

  return { GET, getStaticPaths };
};

const parseMd = async <M extends DefaultM = DefaultM>(
  source: string | { path: string },
  opts?: { parse?: Parse; schema?: MetaSchema<M>; disableCache?: boolean },
): Promise<Md<M>> => {
  const { disableCache, parse, schema } = opts || {};
  const filePath = typeof source === "string" ? undefined : source.path;
  if (!disableCache && filePath) {
    const cached = mdCache.get(filePath)?.get(parse)?.get(schema);
    if (cached) return cached as Promise<Md<M>>;
  }

  const resultP = (async () => {
    const md = typeof source === "string" ? source : await readTextFile(source.path);
    const { body, meta } = await parseYamlFrontmatter(md, schema, filePath);
    const content =
      typeof parse === "function"
        ? unsafeInnerHtml(await parse(body))
        : markdownPlainToHtml(body, parse);
    return { content, meta };
  })();

  if (!disableCache && filePath) {
    mdCache.getOrInsert(filePath, new Map()).getOrInsert(parse, new Map()).set(schema, resultP);
  }
  return resultP;
};

// Parser options and schemas can contain functions, so use their identity as cache keys.
const mdCache = new Map<string, NestedMaps>();
type NestedMaps = Map<Parse | undefined, Map<MetaSchema<DefaultM> | undefined, Promise<Md>>>;

/**
 * Converts a string possibly containing yaml frontmatter to a `{ meta, body }` object.
 *
 * - `meta` is an object with the parsed yaml.
 * - `body` is a string with the rest of the input.
 */
const parseYamlFrontmatter = async <M extends DefaultM>(
  md: string,
  schema: MetaSchema<M> | undefined,
  filePath: string | undefined,
): Promise<{ body: string; meta: M }> => {
  let meta = {} as M;
  let body = md;
  const results = yamlFrontRe.exec(md);
  try {
    if (results) {
      const yaml = results[1] || "";
      const metaObj = yaml.trim() ? parse(yaml, { schema: "core" }) : {};
      if (metaObj && typeof metaObj === "object" && !(metaObj instanceof Array)) {
        body = results[2] || "";
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
// but then adapted to cover more cases. Perhaps we should switch to https://github.com/parksb/markdown-it-front-matter/blob/master/index.js
const yamlFrontRe = /^---(?:\r\n|\n|\r)(?:([\s\S]*?)(?:\r\n|\n|\r))?---(?:\r\n|\n|\r|$)([\s\S]*)$/;
