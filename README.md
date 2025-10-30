# Mastro

The simplest web framework and site generator you've ever seen.

**[Website](https://mastrojs.github.io/)** | [Try Mastro online](https://github.dev/mastrojs/template-basic)

Static site generation and on-demand rendering of HTML or JSON – it all works exactly the same in Mastro: a file-based [router](https://mastrojs.github.io/guide/server-side-components-and-routing/#routing-and-page-handlers), and a handful of [composable functions](https://jsr.io/@mastrojs/mastro/doc) to return standard [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response) objects.
No magic, no config – just focus on building awesome websites.

- **No bloat**: written in just [~700 lines](https://github.com/mastrojs/mastro/tree/main/src#readme) of TypeScript, Mastro is a framework distilled to its essence.
- **No client-side JavaScript** (until you [add some](https://mastrojs.github.io/guide/interactivity-with-javascript-in-the-browser/)): create [MPA](https://mastrojs.github.io/guide/client-side-vs-server-side-javascript-static-vs-ondemand-spa-vs-mpa/) websites that load blazingly [fast](https://mastrojs.github.io/#fast-for-everyone).
- **No bundler** (until you [add one](https://mastrojs.github.io/guide/bundling-assets-caching/)): your code arrives in the browser exactly how you wrote it.
- **No magic**: use normal `<img>` and `<a>` tags referencing HTTP-first [assets](https://mastrojs.github.io/guide/bundling-assets-caching/#transforming-images).
- **No VC-money**: this forces us to stay lean and prevents eventual enshitification.
- **No hosting offer**: selling a service is not what we're interested in.
- **No update treadmill**: we use web standards instead of relying on many [dependencies](https://jsr.io/@mastrojs/mastro/dependencies).


## How to run

### In the browser

Build and deploy your website to GitHub Pages for free – without installing anything: [Get started on GitHub.dev](https://github.dev/mastrojs/template-basic)

### Command line

If you prefer the command line, or need to run a server, install either [Deno](https://deno.com) (recommended), or [Node.js](https://nodejs.org).

#### Deno

After [installing Deno](https://docs.deno.com/runtime/getting_started/installation/), either use the [Mastro template for Deno](https://github.com/mastrojs/template-basic-deno) or run:

    deno run -A npm:@mastrojs/create-mastro@0.0.8

#### Node.js

Either use the [Mastro template for Node.js](https://github.com/mastrojs/template-basic-node) or run:

    pnpm create @mastrojs/mastro@0.0.8

(`npm` and `yarn` also work, but `pnpm` is [recommended](https://jsr.io/docs/npm-compatibility).)

#### Bun

Either use the [Mastro template for Bun](https://github.com/mastrojs/template-basic-bun) or run:

    bun create @mastrojs/mastro@0.0.8


## Deploy to production

To deploy your website, see [Different ways to run Mastro](https://mastrojs.github.io/guide/cli-install/#different-ways-to-run-mastro).


## Extensions

The core of Mastro is tiny. But to get you started quickly for common use-cases, there is a growing list of extensions that are tailored to be used with Mastro. Usually, it's just a single file wrapping a carefully chosen external dependency.

- [@mastrojs/markdown](https://github.com/mastrojs/markdown) – generate HTML from markdown
- [@mastrojs/images](https://github.com/mastrojs/images) – transform images (resize, compress, etc)
- [@mastrojs/feed](https://github.com/mastrojs/feed) – generate an Atom feed
- [Reactive Mastro](https://mastrojs.github.io/reactive/) – a tiny client-side reactive GUI library for MPAs


## Join the community / contribute

It's still early days. But we're looking to build an inclusive community of all kinds of people, united by a shared passion for crafting websites and learning new things.

If you have any questions, or want to talk about future plans, please start a [GitHub Discussion](https://github.com/mastrojs/mastro/discussions/).

Something not working as expected or confusing? That's a bug: please open a [GitHub issue](https://github.com/mastrojs/mastro/issues/).
