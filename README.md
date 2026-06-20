# Mastro

**[Website](https://mastrojs.github.io/)** | [Try Mastro online](https://github.dev/mastrojs/template-basic)

**The simplest web framework and site generator yet.**

🤗 For people who care about their users and web standards.\
👨‍🍳 Build directly on top of the browser and Node.js, Deno, Bun, or Workers.

Mastro was designed from the ground up to use modern browser and runtime built-ins (like view transitions and type-stripping), enabling a [radically simpler design](https://mastrojs.github.io/docs/why-mastro/) where [everything is a route](https://mastrojs.github.io/blog/2026-01-29-everything-is-a-route-one-interface-for-servers-static-sites-and-assets/).

## Minimal yet powerful

- **Static site generation** – ideal for blogs, marketing sites or webshops that are [fast](https://mastrojs.github.io/#fast-for-everyone).
- **Server-side rendering** – use Mastro as a [full-stack web framework](https://mastrojs.github.io/guide/forms-and-rest-apis/#a-mock-database).
- **Everything is a route**: serve [JSON REST APIs](https://mastrojs.github.io/guide/forms-and-rest-apis/#client-side-fetching-a-rest-api), [CSS](https://mastrojs.github.io/blog/2026-05-26-component-scoped-css-without-build-step/), or [images](https://mastrojs.github.io/guide/bundling-assets/#transforming-images), with the [same API](https://mastrojs.github.io/blog/2026-01-29-everything-is-a-route-one-interface-for-servers-static-sites-and-assets/) as HTML.
- **Composable**: a [router](https://mastrojs.github.io/docs/routing/) and plain [helper functions](https://mastrojs.github.io/docs/html-components/) – it's that simple.


## No bloat

- **No overhead**: implemented in just [~800 lines](https://github.com/mastrojs/mastro/tree/main/src#readme) of TypeScript with no dependencies.
- **No client-side JavaScript** (until you [add some](https://mastrojs.github.io/guide/interactivity-with-javascript-in-the-browser/)): create [MPA](https://mastrojs.github.io/guide/client-side-vs-server-side-javascript-static-vs-ondemand-spa-vs-mpa/) websites that load [fast](https://mastrojs.github.io#fast-for-everyone).
- **No bundler** (until you [add one](https://mastrojs.github.io/guide/bundling-assets/)): your code ships exactly how you wrote it.
- **No magic**: use plain `<img>` and `<a>` tags referencing [asset routes](https://mastrojs.github.io/blog/2026-01-29-everything-is-a-route-one-interface-for-servers-static-sites-and-assets/).
- **No VC-money**: no eventual enshitification – selling is none of our business.
- **No update treadmill**: we use web standards instead [dependencies](https://jsr.io/@mastrojs/mastro/dependencies).
- **No lock-in**: swap out Mastro later or fork it – it's only [~800 lines](https://github.com/mastrojs/mastro/tree/main/src#readme) after all.


## How to run

### In the browser

Deploy to GitHub Pages without installing anything: [run Mastro in your browser](https://github.dev/mastrojs/template-basic)

### Command line

#### Deno

After [installing Deno](https://docs.deno.com/runtime/getting_started/installation/), either use the [Mastro template for Deno](https://github.com/mastrojs/template-basic-deno) or run:

    deno run -A npm:@mastrojs/create-mastro@0.1.6

#### Node.js

Either use the [Mastro template for Node.js](https://github.com/mastrojs/template-basic-node) or run:

    pnpm create @mastrojs/mastro@0.1.6

(`npm` and `yarn` also work, but `pnpm` is [recommended](https://jsr.io/docs/npm-compatibility).)

#### Bun

Either use the [Mastro template for Bun](https://github.com/mastrojs/template-basic-bun) or run:

    bun create @mastrojs/mastro@0.1.6

## Documentation

- [Mastro Docs](https://mastrojs.github.io/docs/)
- [Mastro Guide to web dev](https://mastrojs.github.io/guide/)

## Deploy to production

To deploy your website, see [Different ways to run Mastro](https://mastrojs.github.io/guide/cli-install/#different-ways-to-run-mastro).


## Extensions

The core of Mastro is tiny. But to get you started quickly for common use-cases, there is a growing list of extensions that are tailored to be used with Mastro. Often, it's just a single file wrapping a carefully chosen external dependency.

- Tiny libs in the `@mastrojs` namespace:
  - [Reactive Mastro](https://mastrojs.github.io/reactive/) – a tiny client-side reactive GUI library for MPAs
  - [markdown](https://github.com/mastrojs/markdown) to HTML
  - [images](https://github.com/mastrojs/images) – resize/compress/etc.
  - [og-image](https://github.com/mastrojs/og-image) – generate images from text
  - [feed](https://github.com/mastrojs/feed) – generate RSS/Atom feeds
  - [atproto](https://github.com/mastrojs/atproto) – add support for [Standard.site](https://mastrojs.github.io/blog/2026-06-05-how-to-add-standard-site-support-to-your-website/)
  - [api](https://github.com/mastrojs/api) – type-safe REST APIs and clients
  - [result](https://github.com/mastrojs/result) – a minimal `Result` type
- [Install](https://mastrojs.github.io/guide/third-party-packages/) 3rd-party packages like:
  - [Kysely](https://www.kysely.dev/) – type-safe SQL query builder
  - [Sveltia CMS](https://github.com/mastrojs/template-sveltia-cms) – git-based CMS


## Join the community

We're looking to build an inclusive community, where people of all kinds of backgrounds and experience levels feel welcome and safe, and help each other out. A place to ask questions and learn new things.

Do you have a question, need help, or would like to talk about future plans? Please start a [GitHub Discussion](https://github.com/mastrojs/mastro/discussions/) or [chat on Stoat](https://stt.gg/k7QMEaP1).

Something not working as expected or confusing? We consider that a bug. Please open a [GitHub issue](https://github.com/mastrojs/mastro/issues/).
