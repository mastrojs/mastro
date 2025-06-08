import { Layout } from "../components/Layout.ts"
import { html, htmlResponse, renderToStream } from "mastro";

export const GET = () =>
  htmlResponse(renderToStream(
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

        <script type="module" src="todo-list.client.ts"></script>
        `
    })
))
