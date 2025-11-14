# Mastro

The simplest web framework and site generator yet.

**[Website](https://mastrojs.github.io/)** | [Try Mastro online](https://github.dev/mastrojs/template-basic)

- **Minimal yet powerful**: Mastro fills in the few missing pieces that aren't yet built into the platform: a file-based [router](https://mastrojs.github.io/docs/routing/) and a handful of [composable functions](https://mastrojs.github.io/docs/html-components/) to return standard [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response) objects.
- **Static site generation and on-demand server rendering** of HTML or JSON [works all the same](https://mastrojs.github.io/docs/routing/#route-handlers).
- **No bloat**: written in just [~700 lines](https://github.com/mastrojs/mastro/tree/main/src#readme) of TypeScript, Mastro feels like a framework but is just a library.
- **No client-side JavaScript** (until you [add some](https://mastrojs.github.io/guide/interactivity-with-javascript-in-the-browser/)): create [MPA](https://mastrojs.github.io/guide/client-side-vs-server-side-javascript-static-vs-ondemand-spa-vs-mpa/) websites that load blazingly [fast](https://mastrojs.github.io/#fast-for-everyone).
- **No bundler** (until you [add one](https://mastrojs.github.io/guide/bundling-assets-caching/)): your code arrives in the browser exactly how you wrote it.
- **No magic**: use normal `<img>` and `<a>` tags referencing HTTP-first [assets](https://mastrojs.github.io/guide/bundling-assets-caching/#transforming-images).
- **No VC-money**: no eventual enshitification – selling a service is not what we're interested in.
- **No update treadmill**: we use web standards instead of relying on complex [dependencies](https://jsr.io/@mastrojs/mastro/dependencies).
- **No lock-in**: swap out calls to the Mastro library later on. Or fork it – it's only [~700 lines](https://github.com/mastrojs/mastro/tree/main/src#readme) after all.


## How to run

### In the browser

Deploy to GitHub Pages without installing anything: [Get started](https://github.dev/mastrojs/template-basic)

### Command line

#### Deno (recommended)

After [installing Deno](https://docs.deno.com/runtime/getting_started/installation/), either use the [Mastro template for Deno](https://github.com/mastrojs/template-basic-deno) or run:

    deno run -A npm:@mastrojs/create-mastro@0.0.8

#### Node.js

Either use the [Mastro template for Node.js](https://github.com/mastrojs/template-basic-node) or run:

    pnpm create @mastrojs/mastro@0.0.8

(`npm` and `yarn` also work, but `pnpm` is [recommended](https://jsr.io/docs/npm-compatibility).)

#### Bun

Either use the [Mastro template for Bun](https://github.com/mastrojs/template-basic-bun) or run:

    bun create @mastrojs/mastro@0.0.8

## Documentation

- [Mastro Docs](https://mastrojs.github.io/docs/)
- [Mastro Guide to web dev](https://mastrojs.github.io/guide/)

## Deploy to production

To deploy your website, see [Different ways to run Mastro](https://mastrojs.github.io/guide/cli-install/#different-ways-to-run-mastro).


## Extensions

The core of Mastro is tiny. But to get you started quickly for common use-cases, there is a growing list of extensions that are tailored to be used with Mastro. Usually, it's just a single file wrapping a carefully chosen external dependency.

- [@mastrojs/markdown](https://github.com/mastrojs/markdown) – generate HTML from markdown
- [@mastrojs/images](https://github.com/mastrojs/images) – transform images (resize, compress, etc)
- [@mastrojs/og-image](https://github.com/mastrojs/og-image) – generate Open Graph images from text
- [@mastrojs/feed](https://github.com/mastrojs/feed) – generate an Atom feed
- [Reactive Mastro](https://mastrojs.github.io/reactive/) – a tiny client-side reactive GUI library for MPAs


## Join the community / contribute

It’s still early days. But we’re looking to build an inclusive community, where people of all kinds of backgrounds and experience levels feel welcome and safe. A place to ask questions and learn new things, where people help each other out.

Do you have a question, need help, or would like to talk about future plans? Please start a [GitHub Discussion](https://github.com/mastrojs/mastro/discussions/).

Something not working as expected or confusing? We consider that a bug. Please open a [GitHub issue](https://github.com/mastrojs/mastro/issues/).
