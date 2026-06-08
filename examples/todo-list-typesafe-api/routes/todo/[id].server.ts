import { Err, Ok } from "@mastrojs/result";
import { jsonRoute } from "@mastrojs/api/server";
import { boolean, object, optional, string } from "../../validate.js";
import * as db from "../../models/todo.ts";

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
  return !updatedTodo
    ? Err("Not found", 404)
    // let the client know how the updated todo with all fields looks like
    : Ok(updatedTodo);
});
