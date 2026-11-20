# @mastrojs/og-image

A simple helper function to generate a PNG image from some text.

Intended use-case is to generate images for `og:image` [link preview metadata](https://getoutofmyhead.dev/link-preview-meta-tags/) in a [Mastro](https://mastrojs.github.io/) project. But in principle, you can use it to rasterize any text to a PNG.

In typical Mastro fashion, this package is very lean yet quite powerful. Instead of spinning up a whole web browser to take a screenshot of a website (like other og-image generators do), we use [`canvaskit-wasm`](https://www.npmjs.com/package/canvaskit-wasm). This emulates the [standard browser Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/), which you can use to draw a nice background. After that, we draw the text over it and render everything to PNG.

We support newlines and [soft hyphens](https://en.wikipedia.org/wiki/Soft_hyphen), but no hyphenation dictionaries. And if you have too much text it will overflow.

## Install

    pnpm add @mastrojs/og-image


## Usage

Since `canvaskit-wasm` apparently cannot read installed system fonts, you need to bring your own font file, e.g. from [Fontsource](https://fontsource.org/).

```ts
import { renderImage } from "@mastrojs/og-image";

const fontFile = await Deno.readFile("data/Roboto-Bold.ttf");
const response = renderImage(text, { fontFile });
```

We used `Deno.readFile` above, but you could also use `fs.readFile` or Mastro's `readFile` function.

### Mastro blog example

Assuming you have a [Mastro](https://mastrojs.github.io/) project with a markdown file `data/posts/hello.md`, place the following in `routes/[...slug].server.ts`:

```ts
import { readMarkdownFile } from "@mastrojs/markdown";
import { html, htmlToResponse, readDir, readFile } from "@mastrojs/mastro";
import { renderImage } from "@mastrojs/og-image";

const fontFile = await readFile("data/Roboto-Bold.ttf");

export const GET = async (req: Request) => {
  const { pathname } = new URL(req.url);
  const isImage = pathname.endsWith("/og.png");
  const fileName = pathname.slice(1, isImage ? -7 : -1);

  const { content, meta } = await readMarkdownFile(`data/posts/${fileName}.md`);
  const { title = "" } = meta;

  if (isImage) {
    const text = "My blog\n\n" + title;
    return renderImage(text, { fontFile });
  } else {
    return htmlToResponse(html`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta property="og:image" content=${req.url + "og.png"}>
        </head>
        <body>
          <h1>${title}</h1>
          ${content}
        </body>
      </html>
    `);
  }
};

// only needed for static site generation
export const getStaticPaths = async () => {
  const posts = await readDir("data/posts/");
  return posts.flatMap((p) => {
    const path = "/" + p.slice(0, -3) + "/";
    return [path, path + "og.png"];
  });
}
```

Then after launching your dev server, you can access the rendered blog post under `http://localhost:8000/hello/` (don't forget the trailing slash), and the corresponding og-image under `http://localhost:8000/hello/og.png`.

The above is similar to the [blog example in the guide](https://mastrojs.github.io/guide/static-blog-from-markdown-files/), except we're using `[...slug].server.ts` instead of `[slug].server.ts` to capture the routes with the additional slash.

### Image options

See the [`og-image` API docs](https://jsr.io/@mastrojs/og-image/doc) for all properties.

Here's an example setting the background not to a CSS color value string (which is also supported), but to a function that draws to the canvas.

```ts
import { readFile } from "@mastrojs/mastro";
import { renderImage } from "@mastrojs/og-image";

const fontFile = await readFile("data/Roboto-Bold.ttf");
const icon = await readFile("data/icon.png");

export const GET = (req: Request) => {
  return renderImage("Hello World", {
    fontFile,
    paddingTop: 200,
    background: (ctx, canvas) => {
      // draw green background
      ctx.fillStyle = "green";
      ctx.fillRect(0, 0, 1200, 630);

      // draw text at x=100, y=90
      ctx.fillText("My title", 100, 90);

      // draw image on top at x=300, y=100
      ctx.drawImage(canvas.decodeImage(icon) as any, 300, 100);
    },
  });
};
```
