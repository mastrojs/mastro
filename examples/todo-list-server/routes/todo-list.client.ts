import { computed, html, ReactiveElement, signal } from "@mastrojs/reactive";
import type { Todo } from "../models/todo.ts";

// exported so we can use it on the server as well
export const renderTodo = (todo: Todo, i: number) =>
  html`
    <li id="${todo.id}">
      <input
        type="checkbox"
        ${todo.done ? "checked" : ""}
        data-onchange="toggleTodo(${i})"
      >
      ${todo.title}
    </li>
  `;

// on the server, globalThis.customElements will be undefined
globalThis.customElements?.define(
  "todo-list",
  class extends ReactiveElement {
    newTitle = signal("");
    todos = signal(
      // initialize signal from server-rendered HTML. Alternatively,
      // we could send the data twice: once as HTML and once as JSON.
      Array.from(this.querySelectorAll("li")).map((el) => ({
        done: (el.querySelector("input") as HTMLInputElement).checked,
        id: el.id,
        title: el.innerText,
      })),
    );
    renderedTodos = computed(() => this.todos().map(renderTodo));

    async toggleTodo(i: number, e: Event) {
      const todos = [...this.todos()];
      const todo = todos[i];
      todo.done = (e.target as HTMLInputElement).checked;

      // optimistically update GUI
      this.todos.set(todos);

      const res = await fetchApi("PATCH", `/todo/${todo.id}`, {
        done: todo.done,
      });
      if (!res.ok) {
        // if saving to server fails, rollback GUI
        todo.done = !todo.done;
        this.todos.set([...todos]);
      }
    }

    updateNewTitle(e: Event) {
      this.newTitle.set((e.target as HTMLInputElement).value);
    }

    async addTodo(e: Event) {
      e.preventDefault();
      const title = this.newTitle();
      if (title) {
        const newTodo = { id: crypto.randomUUID(), title, done: false };
        const todos = [newTodo, ...this.todos()];

        // optimistically update GUI
        this.todos.set(todos);
        this.newTitle.set("");

        const res = await fetchApi("POST", "/todo/", newTodo);
        if (!res.ok) {
          // if saving to server fails, rollback GUI
          this.todos.set(todos.slice(1));
          this.newTitle.set(title);
        }
      }
    }
  },
);

const fetchApi = (method: string, url: string, data?: unknown) =>
  fetch(url, { method, body: JSON.stringify(data) })
    .catch((error) => ({ ok: false, error }));
