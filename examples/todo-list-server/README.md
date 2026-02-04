# Interactive to-do list with SSR and REST API

This example uses [Reactive Mastro](https://mastrojs.github.io/reactive/) for the client-side interactivity, and [Mastro](https://mastrojs.github.io/) for the server-side-rendering (SSR) and REST API, which the client uses to save to a mock/in-memory database.

On the initial pageload, the to-dos are server-side-rendered. But to initialize the todo signals on the client, we need the data as JSON. We could load them via the REST API, or include the JSON in the initial HTML payload. But both these approaches would send the data twice: once as HTML, and once as JSON. Instead, we [parse the HTML to construct our JSON](https://github.com/mastrojs/mastro/blob/main/examples/todo-list-server/routes/todo-list.client.ts#L23).

Finally, we share the [`renderTodo` function](https://github.com/mastrojs/mastro/blob/main/examples/todo-list-server/routes/todo-list.client.ts#L5) between client and server.

## Folder structure

- 📂 `models/`
  - `todo.ts` – the mock database
- 📂 `routes/`
  - 📂 `todo/`
    - `[id].server.ts` – API route for a single todo
    - `index.server.ts` – API route for the whole collection
  - `index.server.ts` – HTML page
  - `todo-list.client.ts` – client-side JavaScript
- `deno.json` – replace with package.json if you're not using Deno

See also the corresponding [chapter in the Mastro guide](http://localhost:8000/guide/forms-and-rest-apis/#client-side-fetching-a-rest-api).
