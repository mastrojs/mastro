# Mastro

A *m*inimal take on an *Astro*-like MPA web framework. Currently, there are three parts to it:

- [The Mastro Guide](https://mastrojs.github.io/) and accompanying [_Visual Studio Code for the Web_ extension](https://marketplace.visualstudio.com/items?itemName=mastro.mastro-vscode-extension) that teach you how to build and publish your first webside – using only a browser and a GitHub account.
- The Mastro web framework (server and static site generator) – currently focusing on Deno.
- [Reactive Mastro](https://mastrojs.github.io/reactive/) – a tiny reactive GUI library for MPAs.


## Philosophy

- No magic. Nothing is auto-injected into your page.

- Zero client-side JavaScript by default: extremely fast page loads by leveraging native browser functionality instead of reinventing the wheel in JavaScript. See [Why Reactive Mastro?](https://mastrojs.github.io/reactive/why-reactive-mastro/)

- Minimal dependencies (see [deno.json](deno.json))

- No build step or bundler by default (meaning changes during development are instant, and you can debug in the browser).

- While some frameworks try to erase the boundary between client and server (by putting a leaky abstraction on top), Mastro makes it explicit which parts of your app run where and when.

- File-based routing: `routes/` contains files that are served verbatim, as well `.server.js` files that export [route handlers](https://blog.val.town/blog/the-api-we-forgot-to-name/). A handler always takes a `Request` object (and no props, and no context) and returns a `Response` object.

- Server components are simple JS functions that by convention take a props object.

- For client-side components, see [Reactive Mastro](https://mastrojs.github.io/reactive/).

- Easy to understand codebase using simple JS functions wherever possible. Favour small, [composable functions](https://mb21.github.io/blog/2021/09/11/composable-abstractions.html).


## How to run

### _Visual Studio Code for the Web_ extension

- Follow [The Mastro Guide's _Setup_ section](https://mastrojs.github.io/guides/setup/) to install the [_Visual Studio Code for the Web_ extension](https://marketplace.visualstudio.com/items?itemName=mastro.mastro-vscode-extension) and lear how to build and publish your first website – using only a browser and a GitHub account.

### Deno

After [installing Deno](https://docs.deno.com/runtime/getting_started/installation/), either run:

    deno run --allow-write jsr:@mastrojs/mastro@0.0.5/init

or download the contents of the [`examples/hello-world` folder](examples/hello-world/). `cd` into the folder, then:

Start the development server:

    deno task start

Generate the static site:

    deno task generate


## TODOs

- Asset handling (on server startup / static site generation?)
  - support something like CSS Modules? Then again, read [this great article by Heydon Pickering](https://www.smashingmagazine.com/2016/11/css-inheritance-cascade-global-scope-new-old-worst-best-friends/) if you want to be convinced otherwise.
  - image resizing
