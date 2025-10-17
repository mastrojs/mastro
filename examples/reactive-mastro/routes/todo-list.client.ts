import { computed, html, ReactiveElement, signal } from '@mastrojs/reactive'

type TodoItem = { title: string; done: boolean }

const localSignal = <T>(initialVal: T, key: string) => {
  try {
    initialVal = JSON.parse(localStorage[key])
  } catch (_e) {
    // ignore
  }
  const s = signal(initialVal)
  const local = () => s()
  local.set = (newVal: T) => {
    s.set(newVal)
    localStorage[key] = JSON.stringify(newVal)
  }
  return local
}

customElements.define('todo-list', class extends ReactiveElement {
  newTitle = signal('')
  todos = localSignal<TodoItem[]>([], 'todos')

  renderedTodos = computed(() =>
    this.todos().map((todo, i) => html`
      <li>
        <input
          type="checkbox"
          ${todo.done ? 'checked' : ''}
          data-onchange='toggleTodo(${i})'
          >
        ${todo.title}
        <button data-onclick="removeTodo(${i})">x</button>
      </li>
    `)
  )

  toggleTodo (i: number, e: Event) {
    const { checked } = e.target as HTMLInputElement
    const todos = [...this.todos()]
    todos[i].done = checked
    this.todos.set(todos)
  }

  updateNewTitle (e: Event) {
    const { value } = e.target as HTMLInputElement
    this.newTitle.set(value)
  }

  addTodo (e: SubmitEvent) {
    e.preventDefault()
    if (this.newTitle()) {
      this.todos.set([{ title: this.newTitle(), done: false }, ...this.todos()])
      this.newTitle.set('')
    }
  }

  removeTodo (i: number) {
    const todos = this.todos()
    this.todos.set([...todos.slice(0, i), ...todos.slice(i + 1)])
  }
})
