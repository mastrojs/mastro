The source code of the core Mastro library plus the following two files consists of only ~700 lines of TypeScript.

- [`generator.ts`](generator.ts) contains everything related to static site generation and is used in both the VSCode extension and Deno/Node.js.
- [`server.ts`](server.ts) contains the server handler that can be passed to `Deno.serve`.

The "@mastrojs/mastro" package [re-exports](core/index.ts) the following files from the `core/` folder:

- [`fs.ts`](core/fs.ts) contains the `readDir`, `readTextFile`, and `findFiles` functions, that work in both, the VSCode extension environment and Deno/Node.js.
- [`html.ts`](core/html.ts) contains the `html` tagged template literal to construct properly escaped HTML strings.
- [`responses.ts`](core/responses.ts) – helper functions to create standard [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects.
- [`router.ts`](core/router.ts) – Mastro's file-based router, which creates a list of routes based on the `*.server.(js|ts)` files in your project's `routes/` folder.
