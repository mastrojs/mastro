import { jsonResponse } from "@mastrojs/mastro";
import * as db from "../../models/todo.ts";

export const POST = async (req: Request) => {
  const { done, id, title } = await req.json();
  if (!id || !title) {
    // for more complex data, you'd want to define a schema and validate
    // incoming data with a schema library. See for example
    // https://standardschema.dev#what-schema-libraries-implement-the-spec
    return jsonResponse({ error: "Todo must have an id and a title" }, 400);
  } else {
    const todo = { done, id, title };
    await db.addTodo(todo);
    return jsonResponse(todo);
  }
};
