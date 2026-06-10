The source code of the Mastro library consists of only ~800 lines of TypeScript.
<details>
<summary>including types, but excluding tests, comments, and blank lines</summary>

    tokei src --exclude "*.test.ts" --exclude "*.bench.ts" --output json | jq ".TypeScript.code"
</details>

## Core

The `@mastrojs/mastro` package [re-exports](core/index.ts) the following files from the `core/` folder:

- [`fs.ts`](core/fs.ts) contains the `readDir`, `readTextFile`, and `findFiles` functions, that work in both the VSCode extension environment and Deno/Node.js/Bun.
- [`html.ts`](core/html.ts) contains the `html` tagged template literal to construct properly escaped HTML strings.
- [`responses.ts`](core/responses.ts) – helper functions to create standard [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects.


## Static site generator and server

- [`generator.ts`](generator.ts) contains everything related to static site generation.
- [`server/handler.ts`](server/handler.ts) creates the server handler that can be passed to `Deno.serve` etc. It uses [`server/serveStaticFile.ts`](server/serveStaticFile.ts).
- [`routers/fileRouter.ts`](routers/fileRouter.ts) – Mastro's default file-based router, which creates a list of routes based on the `*.server.{js,ts}` files in your project's `routes/` folder.
- [`routers/programmaticRouter.ts`](routers/programmaticRouter.ts) – Mastro's programmatic (Express-like) router.
