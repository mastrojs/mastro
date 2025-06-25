import { getParams, jsonResponse } from "mastro";
import * as db from "../../models/todo.ts";

export const PATCH = async (req: Request) => {
  const { done, title } = await req.json();
  const { id } = getParams(req.url);
  if (!id) {
    return jsonResponse({ error: "Not found" }, 404);
  } else {
    const updatedTodo = await db.updateTodo(id, { done, title });
    if (!updatedTodo) {
      return jsonResponse({ error: "Not found" }, 404);
    } else {
      // let the client know how the updated todo with all fields looks like
      return jsonResponse(updatedTodo);
    }
  }
};
