export interface Todo {
  done: boolean;
  id: string;
  title: string;
}

// mock database (functions are async because they'd be async in a real database)
const todos: Todo[] = [];

export const addTodo = async (todo: Todo) => todos.unshift(todo);

export const findTodos = async () => todos;

export const updateTodo = async (id: string, todoUpdate: Partial<Todo>) => {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    if (todoUpdate.done !== undefined) {
      todo.done = todoUpdate.done;
    }
    if (todoUpdate.title !== undefined) {
      todo.title = todoUpdate.title;
    }
    return todo;
  }
};
