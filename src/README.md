The source code of Mastro consists of only ~700 lines of TypeScript.

- [`reactive/`](reactive/) contains the source code of the [Reactive Mastro](https://mastrojs.github.io/reactive/) client-side library.
- [`generator.ts`](generator.ts) contains everything related to static site generation and is used in both the VSCode extension and Deno.
- [`server.ts`](server.ts) contains the server handler that can be passed to `Deno.serve`.

The core Mastro library [re-exports](index.ts) the following files:

- [`fs.ts`](fs.ts) contains the `readDir`, `readTextFile`, and `findFiles` functions, that work both in the VSCode environment and when using Deno.
- [`html.ts`](html.ts) contains the `html` tagged template literal to construct properly escaped HTML strings.
- [`markdown.ts`](markdown.ts) – helper functions around the `micromark` library.
- [`responses.ts`](responses.ts) – helper functions to create standard [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects.
- [`router.ts`](router.ts) – Mastro's file-based router, which creates a list of routes based on the `*.server.(js|ts)` files in your project's `routes/` folder.
