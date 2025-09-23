import { html, htmlToResponse } from "mastro";
import { renderTodo } from "./todo-list.client.ts";
import * as db from "../models/todo.ts";

export const GET = async () => {
  const todos = await db.findTodos();
  return htmlToResponse(
    html`
      <!DOCTYPE html>
      <title>My To-Do list</title>
      <script type="importmap">
      {
        "imports": {
          "mastro/reactive": "https://esm.sh/jsr/@mastrojs/mastro@0.3.2/reactive?bundle"
        }
      }
      </script>
      <script type="module" src="todo-list.client.js"></script>

      <todo-list>
        <form data-onsubmit="addTodo">
          <input
            placeholder="Enter new to-do here"
            data-bind="value=newTitle"
            data-oninput="updateNewTitle"
          >
          <button>+</button>
        </form>
        <ul data-bind="renderedTodos">
          ${todos.map(renderTodo)}
        </ul>
      </todo-list>
    `,
  );
};
