# Mastro

A *m*inimal take on an *Astro*-like MPA web framework. There are four parts to it:

- [Static site generator running in your browser](https://mastrojs.github.io/guide/setup/) in a _VS Code for the Web_ extension.
- The Mastro web framework (server and static site generator) – see below.
- [Reactive Mastro](https://mastrojs.github.io/reactive/) – a tiny (2.8k min.gz) client-side reactive GUI library for your existing MPA or Mastro project.
- [The Mastro Guide](https://mastrojs.github.io/) ([source](https://github.com/mastrojs/mastrojs.github.io)) shows you how to build and publish your first webside – using only a browser and a GitHub account – as well as dives into more advance topics in the later chapters.


## Craft websites with care

- **No bloat**: written in just [~700 lines](src/#readme) of TypeScript and with [minimal dependencies](deno.json), Mastro is a framework distilled to its essence. It loads fast even [within VS Code for the Web](https://mastrojs.github.io/guide/setup/) or the edge, like Deno Deploy (Node.js, Bun and Cloudflare Workers are in the works). If you ever outgrow it, simply fork and adjust it.

- **No magic and no bundler**: full control over your HTML, CSS and JS. Nothing is auto-injected into your page. Mastro gives you composable functions, instead of complex tooling that messes with your code before it reaches the browser.

- **No leaky abstractions**: while some JS meta-frameworks try to erase the boundary between client and server, Mastro makes it explicit which parts of your app run where and when.

- **No client-side JavaScript** by default: create lean websites, that load blazingly fast. Leveraging native browser functionality instead of reinventing the wheel in JavaScript and [embracing an MPA architecture](https://mastrojs.github.io/reactive/why-reactive-mastro/).


## How to run

### _Visual Studio Code for the Web_ extension (SSG)

Follow [The Mastro Guide's _Setup_ section](https://mastrojs.github.io/guide/setup/) to build and deploy your website to GitHub Pages for free – without ever leaving your browser.

### Server or SSG with Deno on the command line

If you prefer the command line, after [installing Deno](https://docs.deno.com/runtime/getting_started/installation/), either run:

    deno run -A jsr:@mastrojs/mastro@0.1.2/init

or use the [template on GitHub](https://github.com/mastrojs/template-basic-deno). `cd` into the folder, then:

Start the development server:

    deno task start

Generate the static site:

    deno task generate

To deploy the static site, [configure GitHub Pages](https://github.com/mastrojs/mastrojs.github.io/tree/main/.github/workflows/deploy.yml).

#### Deploy server to production

[Join Deno Deploy<sup>EA</sup>](https://docs.deno.com/deploy/early-access/) (Early Access) and set up a [new app](https://app.deno.com/mastrojs/~/new) with the following build configuration:

- Framework preset: No Preset
- Install command: `deno install`
- Build command: blank
- Dynamic App -> Entrypoint: `server.ts`


## Alternatives

There are [many ways to build websites](http://localhost:4321/guide/why-html-css/#you-want-to-build-a-website).
But if we limit ourselves to JavaScript server frameworks and static site generators (SSG),
here is a list of projects with a somewhat similar philosophy in alphabetical order.
(Are we missing one that should be on the list? Make a PR.)

|                                  | Output      | Router       | Templating               |   Bundler           |
| -------------------------------- | ----------- | ------------ | ------------------------ | ------------------- |
| [Adonis](https://adonisjs.com)   | SSG         | programmatic | EdgeJS/Pug/Nunjucks      | optionally Vite     |
| [Astro](https://astro.build)     | SSG/Server  | file-based   | Astro (JSX-like)         | Vite                |
| [Brisa](https://brisa.build)     | SSG/Server  | file-based   | JSX                      | Bun build           |
| [Eleventy](https://www.11ty.dev) | SSG         | file-based   | Liquid/Nunjucks/WebC etc | optional            |
| [Elysia](https://elysiajs.com)   | Server      | programmatic | JSX                      | Bun build
| [Enhance](https://enhance.dev)   | Server      | file-based   | html tagged template     | optionally esbuild  |
| [Fresh](https://fresh.deno.dev)  | Server      | file-based   | JSX                      | optionally esbuild  |
| [h3](https://h3.dev/)            | Server      | programmatic | -                        | -                   |
| [Haunty](https://haunty.org)     | SSG         | file-based   | mustache-like            | -                   |
| [Hono](https://hono.dev)         | SSG/Server  | programmatic | html tagged template     | optionally esbuild  |
| Mastro                           | SSG/Server  | file-based   | html tagged template     | -                   |
| [Nue](https://nuejs.org)         | SSG         | file-based   | custom                   | -                   |

What we believe differentiates Mastro, is that it's even simpler and even more minimal than the others.


## Community / Contribute

Something not working as expected? Would you like to contribute? Do you have a suggestion? Please see [open issues](https://github.com/mastrojs/mastro/issues) and don't hesitate to open a new one to start a conversation!
