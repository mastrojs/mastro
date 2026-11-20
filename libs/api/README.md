# @mastrojs/api

Build typesafe JSON REST APIs and clients using [Mastro](https://mastrojs.github.io/) and TypeScript.

The client is a thin wrapper around `fetch`.
Validate input on the server by bringing your own [Standard Schema](https://standardschema.dev/)-compliant validation library (e.g. [Zod](https://zod.dev), [Valibot](https://valibot.dev) or [validate.js](https://github.com/jakelazaroff/validate.js)).
No bundler required, as only types are shared between the client and server.


## Install

    pnpm add @mastrojs/api


## Usage

### Server-side part

Place the following into `routes/todo/[id].server.ts` (this is using a vendored [validate.js](https://github.com/jakelazaroff/validate.js)).

 ```ts
import { Err, Ok } from "@mastrojs/result";
import { boolean, object, optional, string } from "../../validate.js";

export type TodoPatch = typeof PATCH;
export const { PATCH } = jsonRoute({
  method: "PATCH",
  path: `/todo/${"id" as string}`,
  params: object({ id: string }),
  body: object({ done: optional(boolean), title: optional(string) }),
}, async ({ body, params }) => {
  const { done, title } = body;
  const { id } = params;
  const updatedTodo = await db.updateTodo(id, { done, title });
  return updatedTodo ? Ok(updatedTodo) : Err("Not found", 404);
});
```

### Client-side part

For example in `routes/todo-list.client.ts`:

```ts
import { fetchApi } from "@mastrojs/api/client";
import type { TodoPatch } from "./todo/[id].server.ts";

// onUpdate:
const res = await fetchApi<TodoPatch>("PATCH", `/todo/${todo.id}`, todo);
```


## Docs

For a full working example, see [todo-list-typesafe-api](https://github.com/mastrojs/mastro/tree/main/examples/todo-list-typesafe-api).

For all exported functions and their documentation, see the [server source](src/server.ts) and [client source](src/client.ts).


## Implementation

`@mastrojs/api` is not the first library to use shared types to safely integrate the frontend with the backend, but it is likely the smallest. The [source code](./src) is as straightforward as possible, using no [type-level](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html) magic except a [phantom type](https://dev.to/busypeoples/notes-on-typescript-phantom-types-kg9) to carry over the type information over from the frontend to the backend.

Unlike [tRPC](https://trpc.io/), `@mastrojs/api` allows you to use [REST](https://mastrojs.github.io/guide/forms-and-rest-apis/#about-rest-apis) – i.e. the full HTTP semantics, including all possible HTTP verbs (not only `POST`).
Compared to [Hono RPC](https://hono.dev/docs/guides/rpc) or [Elysia](https://elysiajs.com/), typechecking is fast – no matter how many routes you have. This comes at the cost of you having to type out the `path` parameter manually again.
