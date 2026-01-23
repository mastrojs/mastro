# Mastro

**The simplest web framework and site generator yet.**

Mastro is a **minimal** tool to build **content-driven websites**. Use **web standards** and plain JavaScript – work directly _with_ the high-performance engine that is a modern browser.

**[Website](https://mastrojs.github.io/)** | [Try Mastro online](https://github.dev/mastrojs/template-basic)

### Minimal yet powerful

- **It all works the same**: HTML pages, JSON [REST APIs](https://mastrojs.github.io/guide/forms-and-rest-apis/#client-side-fetching-a-rest-api), RSS [feeds](https://jsr.io/@mastrojs/feed) – you name it.
- **_SSG_ and _SSR_**: static site generation _and_ on-demand [server-side rendering](https://mastrojs.github.io/docs/install-setup/).
- **Composable abstractions**: a [router](https://mastrojs.github.io/docs/routing/) and a few [helper functions](https://mastrojs.github.io/docs/html-components/) – that's all.
- **Multi-runtime**: works on Deno, Node.js, Bun and Workers.

### No bloat

- **No overhead**: written in just [~700 lines](https://github.com/mastrojs/mastro/tree/main/src#readme) of TypeScript, Mastro runs [fast](https://mastrojs.github.io#fast-for-everyone).
- **No client-side JavaScript** (until you [add some](https://mastrojs.github.io/guide/interactivity-with-javascript-in-the-browser/)): create [MPA](https://mastrojs.github.io/guide/client-side-vs-server-side-javascript-static-vs-ondemand-spa-vs-mpa/) websites that load [fast](https://mastrojs.github.io#fast-for-everyone).
- **No bundler** (until you [add one](https://mastrojs.github.io/guide/bundling-assets/)): your code ships exactly as you wrote it.
- **No magic**: use plain `<img>` and `<a>` tags referencing [HTTP-first assets](https://mastrojs.github.io/guide/bundling-assets/#bundling-css).
- **No VC-money**: no eventual enshitification – selling is none of our business.
- **No update treadmill**: we use web standards instead of complex [dependencies](https://jsr.io/@mastrojs/mastro/dependencies).
- **No lock-in**: swap out Mastro later or fork it – it's only [~700 lines](https://github.com/mastrojs/mastro/tree/main/src#readme) after all.


## How to run

### In the browser

Deploy to GitHub Pages without installing anything: [Run Mastro in your browser](https://github.dev/mastrojs/template-basic)

### Command line

#### Deno (recommended)

After [installing Deno](https://docs.deno.com/runtime/getting_started/installation/), either use the [Mastro template for Deno](https://github.com/mastrojs/template-basic-deno) or run:

    deno run -A npm:@mastrojs/create-mastro@0.0.9

#### Node.js

Either use the [Mastro template for Node.js](https://github.com/mastrojs/template-basic-node) or run:

    pnpm create @mastrojs/mastro@0.0.9

(`npm` and `yarn` also work, but `pnpm` is [recommended](https://jsr.io/docs/npm-compatibility).)

#### Bun

Either use the [Mastro template for Bun](https://github.com/mastrojs/template-basic-bun) or run:

    bun create @mastrojs/mastro@0.0.9

## Documentation

- [Mastro Docs](https://mastrojs.github.io/docs/)
- [Mastro Guide to web dev](https://mastrojs.github.io/guide/)

## Deploy to production

To deploy your website, see [Different ways to run Mastro](https://mastrojs.github.io/guide/cli-install/#different-ways-to-run-mastro).


## Extensions

The core of Mastro is tiny. But to get you started quickly for common use-cases, there is a growing list of extensions that are tailored to be used with Mastro. Usually, it's just a single file wrapping a carefully chosen external dependency.

- [Reactive Mastro](https://mastrojs.github.io/reactive/) – a tiny client-side reactive GUI library for MPAs
- [@mastrojs/markdown](https://github.com/mastrojs/markdown) – generate HTML from markdown
- [@mastrojs/images](https://github.com/mastrojs/images) – transform images (resize, compress, etc)
- [@mastrojs/og-image](https://github.com/mastrojs/og-image) – generate Open Graph images from text
- [@mastrojs/feed](https://github.com/mastrojs/feed) – generate an Atom feed
- [Kysely](https://www.kysely.dev/) – type-safe SQL query builder
- [Sveltia CMS](https://github.com/mastrojs/template-sveltia-cms) – git-based CMS


## Join the community / contribute

We're looking to build an inclusive community, where people of all kinds of backgrounds and experience levels feel welcome and safe, and help each other out. A place to ask questions and learn new things.

Do you have a question, need help, or would like to talk about future plans? Please start a [GitHub Discussion](https://github.com/mastrojs/mastro/discussions/).

Something not working as expected or confusing? We consider that a bug. Please open a [GitHub issue](https://github.com/mastrojs/mastro/issues/).
