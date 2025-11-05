import { Layout } from "../components/Layout.ts"
import { html, htmlToResponse } from "@mastrojs/mastro";

export const GET = () =>
  htmlToResponse(
    Layout({
      title: "Todo-list example",
      children: html`
        <todo-list>
          <form data-onsubmit="addTodo">
            <input data-bind="value=newTitle" data-oninput="updateNewTitle">
            <button>+</button>
          </form>
          <ul data-bind="renderedTodos">
          </ul>
        </todo-list>

        <script type="module" src="/todo-list.client.js"></script>
        `
    })
)
