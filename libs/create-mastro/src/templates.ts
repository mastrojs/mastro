import fs from "node:fs/promises";
import { join } from "node:path";

import { updateDeps, type CliContext } from "./helpers.ts";

export const updateFilesForBlog = async (ctx: CliContext, dir: string) => {
  await Promise.all(
    ["components", "data", "routes"].map(async (folder) => {
      await fs.rm(join(dir, folder), { recursive: true, force: true });
      return fs.rename(join(ctx.zipOutDir, "examples", "blog", folder), join(dir, folder));
    }),
  );
  await updateDeps(dir, (deps) => {
    deps["@mastrojs/markdown"] = "^0";
  });
};

export const addSveltiaFiles = async (dir: string) => {
  const sveltiaConfig = `# yaml-language-server: $schema=https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json

backend:
  name: github
  repo: user/repo

media_folder: /routes/media
public_folder: /media

collections:
  - name: posts
    label: Posts
    folder: /data/posts
    fields:
      - { label: Title, name: title, widget: string }
      - { label: Body, name: body, widget: markdown }
`;

  const sveltiaIndexHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>Sveltia CMS</title>
  </head>
  <body>
    <!--
    You can also pin a version like https://unpkg.com/@sveltia/cms@0.129.2/dist/sveltia-cms.js
    or instead of loading from unpkg.com, download the file and save it in your routes folder.
    -->
    <script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"></script>
  </body>
</html>
`;
  await fs.mkdir(join(dir, "routes", "admin"));
  await Promise.all([
    fs.writeFile(join(dir, "routes", "admin", "config.yml"), sveltiaConfig),
    fs.writeFile(join(dir, "routes", "admin", "index.html"), sveltiaIndexHtml),
    fs.appendFile(
      join(dir, "README.md"),
      "\n\n## Sveltia CMS\n\nOpen <http://localhost:8000/admin/> in your browser.\n",
    ),
  ]);
};

export const agentsMd = `We're using the Mastro web framework.

- Use web search with \`site:mastrojs.github.io\` to look up Mastro docs.
- Use web search with \`site:developer.mozilla.org\` to look up web platform
  features (or the [modern-web-guidance](https://developer.chrome.com/docs/modern-web-guidance) skills).
  Use web APIs if they are "Baseline Widely available".
- Write semantic HTML.
- CSS
  - Never add inline CSS
  - Avoid adding classes if you can use HTML element selectors
  - Use a [two-layer approach](https://theadminbar.com/semantics-and-primitives-color-system/)
    for CSS variables (primitives like \`--blue: #0000ff\`,
    and semantics like \`--link-color: var(--blue)\`).
  - Ask the user whether they want to only have a single global
    [styles.css](routes/styles.css) file (good for smaller projects),
    or whether they want to colocate CSS files with their HTML
    in [components](components/) and if so
    [which approach they prefer](https://mastrojs.github.io/blog/2026-05-26-component-scoped-css-without-build-step/)
- Only use [client-side JavaScript](https://mastrojs.github.io/guide/interactivity-with-javascript-in-the-browser/)
  if absolutely necessary. If so, use \`<script type="module">\`.
`;
