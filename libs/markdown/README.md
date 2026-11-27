# @mastrojs/markdown

A few simple helper functions to generate HTML from markdown. Just enough to get you started with markdown with [Mastro](https://mastrojs.github.io/).

By default, it uses `micromark` with `micromark-extension-gfm` under the hood.

Validate YAML frontmatter by bringing your own [Standard Schema](https://standardschema.dev/)-compliant validation library (e.g. [Zod](https://zod.dev), [Valibot](https://valibot.dev) or [validate.js](https://github.com/jakelazaroff/validate.js)).


## Install

The easiest way to get started is to [install Mastro](https://mastrojs.github.io/#powerful-for-experienced-developers) and select the "blog" template. Alternatively:

    pnpm add @mastrojs/markdown


## Usage

```ts
import { renderToString } from "@mastrojs/mastro";
import { markdownToHtml } from "@mastrojs/markdown";

const { content, meta } = await markdownToHtml(`
---
title: my title
---

hi *there*
`);

const htmlStr = await renderToString(content);
```

In addition to `markdownToHtml(inputStr, opts)`, there is:

- `readMarkdownFile(filePath, opts)`
- `readMarkdownFiles(globPattern, opts)`
- `serveMarkdownFolder(opts, renderFn)`

See the [source](src/markdown.ts) for their documentation.

For a tutorial, read the chapter [A static blog from markdown files](https://mastrojs.github.io/guide/static-blog-from-markdown-files/) in the Mastro Guide.

### Options

#### Disable cache

It's common to have an index page, and a detail page, that both convert the same markdown file. That's why `readMarkdownFile`, `readMarkdownFiles`, and `serveMarkdownFolder` share a module-level cache that's turned on by default. The cache key is `(filePath, opts.parse, opts.schema)`, and even failed conversions are cached. This works well for static site generation, and development with `node --watch-path . server.ts` (which restarts the server on any markdown file changes).

If you convert the same file with different options, or change markdown files without restarting the server, turn the cache off:

```ts
const post = await readMarkdownFile("data/post.md", { disableCache: true });
```

#### Parse

The `parse` option can either take an options object, or a parse function. To supply a [Micromark options object](https://github.com/micromark/micromark/blob/main/packages/micromark/readme.md#options):

```ts
const { content, meta } = await markdownToHtml(input, { parse: { allowDangerousHtml: true } });
```

Micromark is fairly basic (e.g. no server-side syntax highlighting of code blocks, but you can use e.g. [microlighter](https://davatron5000.github.io/microlighter/) or [syntaxp](https://github.com/j9t/syntaxp)). If you want a more feature-rich markdown engine, supply a custom markdown-to-HTML function to `parse`, which will be called with the markdown body (YAML frontmatter already stripped).

For example using [markdown-it](https://github.com/markdown-it/markdown-it):

```ts
import { markdownToHtml } from "@mastrojs/markdown";
import markdownIt from "markdown-it";

const { content, meta } = await markdownToHtml(input, { parse: markdownIt.render });
```

Or using [remark-rehype](https://github.com/remarkjs/remark-rehype):

```ts
import { markdownToHtml } from "@mastrojs/markdown";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

const parse = async (markdownText: string) =>
  String(
    await unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeHighlight)
      .use(rehypeStringify)
      .process(markdownText)
  );
const { content, meta } = await markdownToHtml(input, { parse });
```

#### Schema

The default TypeScript type for the YAML metadata is `Record<string, unknown>`. You can override that with e.g. `readMarkdownFile<{title: string}>("post.md")`. But to actually verify the metadata is correct, you should use a schema. For example using [validate.js](https://github.com/jakelazaroff/validate.js):

```ts
import { object, string } from "./validate.js";
const schema = object({
  title: string,
});
const { content, meta } = await markdownToHtml(input, { schema });
```
