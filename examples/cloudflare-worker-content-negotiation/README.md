# Basic blog using a CF Workers for content negotiation

This example demonstrates how [Mastro](https://mastrojs.github.io) can be used to return HTML to web browsers (or anyboy who prefers `text/html`), and Markdown to anyone else (e.g. `curl`, or AI crawlers that might prefer `text/markdown`).

There are two stages:

1. Static site generation with Node: when running `pnpm run generate`, the `generated` folder is created with both the original Markdown versions of the blog posts, and the output HTML versions. Thus the expensive part (md -> html conversion) only happens once at build time, and we can make the Worker bundle smaller by not including the markdown engine.

2. Cloudflare Worker: when running `pnpm run dev`, Wrangler with its dev server is started. Just like in production, the Cloudflare Worker only does [content negotiation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Content_negotiation), then uses `env.ASSETS.fetch` to return the static assets that were generated previously.

Entry-point for both is [server.ts](server.ts)

See the [Mastro Cloudflare template](https://github.com/mastrojs/template-basic-cloudflare) for more info.
