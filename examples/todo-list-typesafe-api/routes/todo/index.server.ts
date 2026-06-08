import { Ok } from "@mastrojs/result";
import { jsonRoute } from "@mastrojs/api/server";
import { boolean, object, string } from "../../validate.js";
import * as db from "../../models/todo.ts";

export type TodoPost = typeof POST;
export const { POST } = jsonRoute({
  method: "POST",
  path: "/todo/",
  body: object({ done: boolean, id: string, title: string }),
}, async ({ body }) => {
  const { done, id, title } = body;
  const todo = { done, id, title };
  await db.addTodo(todo);
  return Ok(todo);
});
