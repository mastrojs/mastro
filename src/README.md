The source code of the core Mastro library, together with the `generator.ts` and `server.ts` files, consists of only ~700 lines of TypeScript (excluding tests and comments).

- [`generator.ts`](generator.ts) contains everything related to static site generation.
- [`server.ts`](server.ts) contains the server handler that can be passed to `Deno.serve`.
- [`routers/fileRouter.ts`](routers/fileRouter.ts) – Mastro's file-based router, which creates a list of routes based on the `*.server.{js,ts}` files in your project's `routes/` folder.

The "@mastrojs/mastro" package [re-exports](core/index.ts) the following files from the `core/` folder:

- [`fs.ts`](core/fs.ts) contains the `readDir`, `readTextFile`, and `findFiles` functions, that work in both the VSCode extension environment and Deno/Node.js/Bun.
- [`html.ts`](core/html.ts) contains the `html` tagged template literal to construct properly escaped HTML strings.
- [`responses.ts`](core/responses.ts) – helper functions to create standard [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects.
