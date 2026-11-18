import { type Handler, jsonResponse } from "@mastrojs/mastro";
import * as db from "../../models/todo.ts";

export const PATCH: Handler = async (req, { params }) => {
  const { done, title } = await req.json();
  const { id } = params;
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
