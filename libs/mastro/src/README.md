The source code of the Mastro library consists of only ~900 lines of TypeScript.
<details>
<summary>including types, but excluding tests, comments, and blank lines</summary>

In `libs/mastro/src`:

    tokei --exclude "*.test.ts" --exclude "*.bench.ts" --exclude "*.d.ts" --output json | jq ".TypeScript.code"
</details>


## Core

The `@mastrojs/mastro` package [main entry point](index.ts) exports the [Mastro app class](mastro.ts) (used directly for programmatic routing, and indirectly with the file-based router), as well as the following files from `core/`:

- [`fs.ts`](core/fs.ts) contains the `readDir`, `readTextFile`, and `findFiles` functions, that work in both the VSCode extension environment and Deno/Node.js/Bun.
- [`html.ts`](core/html.ts) contains the `html` tagged template literal to construct properly escaped HTML strings.
- [`responses.ts`](core/responses.ts) – helper functions to create standard [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects.


## Middlewares

[`middlewares/`](middlewares) contains a few default middlewares (e.g. for handling static files) that are used when running the static site generator or the Node.js server. They are exported under `@mastrojs/server`;


## Static site generator and server

- [`cli.ts`](cli.ts) contains the command line interface (e.g. `mastro generate`) that calls `generator.ts` internally.
- [`generator.ts`](generator.ts) contains the static site generation code.
- [`servers/server.ts`](servers/server.ts) exports helpers suited for starting a Node.js server: `createApp`, `createFileRouterApp` and the default middlewares.
