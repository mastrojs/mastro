# Mastro

A *m*inimal take on an *Astro*-like MPA web framework. There are four parts to it:

- [The Mastro Guide](https://mastrojs.github.io/) that shows you how to build and publish your first webside – using only a browser and a GitHub account.
- [Static site generator running in your browser](https://mastrojs.github.io/guide/setup/) in a _VS Code for the Web_ extension.
- The Mastro web framework (server and static site generator) – see below.
- [Reactive Mastro](https://mastrojs.github.io/reactive/) – a tiny (2.8k min.gz) client-side reactive GUI library for your existing MPA or Mastro project.


## Philosophy

- **No magic and no bundler**: Mastro provides you with a handful of composable helper functions, and gives you full control over your HTML, CSS and JS. Nothing is auto-injected into your page. No complexing tooling is messing with your code before it reaches the browser.

- **No leaky abstractions**: while some JS meta-frameworks try to erase the boundary between client and server, Mastro makes it explicit which parts of your app run where and when.

- **No client-side JavaScript** by default: create lean websites, that load blazingly fast. Leveraging native browser functionality instead of reinventing the wheel in JavaScript and [embracing an MPA architecture](https://mastrojs.github.io/reactive/why-reactive-mastro/).

- **No bloat**: written in just [~700 lines](src/#readme) of TypeScript and with [minimal dependencies](deno.json), Mastro is easy to fork and adapt. It runs either as a static site generator as a [VS Code extension in your browser](https://mastrojs.github.io/guide/setup/), or on Deno (Node.js, Bun and Workers are in the works).


## How to run

### _Visual Studio Code for the Web_ extension

Follow [The Mastro Guide's _Setup_ section](https://mastrojs.github.io/guide/setup/) to build and deploy your website to GitHub Pages for free – without ever leaving your browser.

### Command line with Deno

If you prefer the command line, after [installing Deno](https://docs.deno.com/runtime/getting_started/installation/), either run:

    deno run -A jsr:@mastrojs/mastro@0.0.7/init

or download the contents of the [`examples/hello-world`](examples/hello-world/) folder. `cd` into the folder, then:

Start the development server:

    deno task start

Generate the static site:

    deno task generate


## Contribute

Do you have an idea how Mastro could be improved? Something not working as expected? Don't hesitate to open [an issue](https://github.com/mastrojs/mastro/issues).


## Alternatives

There are [many ways to build websites](http://localhost:4321/guide/why-html-css/#you-want-to-build-a-website).
But if we limit ourselves to JavaScript server frameworks and static site generators (SSG),
here is a list of projects with a somewhat similar philosophy (in alphabetical order):

- [Adonis](https://adonisjs.com) (server-only)
- [Astro](https://astro.build)
- [Brisa](https://brisa.build)
- [Eleventy](https://www.11ty.dev) (SSG-only)
- [Elysia](https://elysiajs.com) (server-only)
- [Enhance](https://enhance.dev) (server-only)
- [Fresh](https://fresh.deno.dev) (server-only)
- [h3](https://h3.dev/) (server-only)
- [Haunty](https://haunty.org) (SSG-only)
- [Hono](https://hono.dev)
- [Nue](https://nuejs.org) (SSG-only)

Are we missing one that should be on the list? Make a PR.


## TODOs

- Support Node.js and test on Bun, Cloudflare
- Asset handling (on server startup / static site generation?)
  - support something like CSS Modules? Then again, read [this great article by Heydon Pickering](https://www.smashingmagazine.com/2016/11/css-inheritance-cascade-global-scope-new-old-worst-best-friends/) if you want to be convinced otherwise.
  - image transformations/resizing
