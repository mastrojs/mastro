import { html } from 'mastro/html.ts'

export const Counter = () => html`
  <my-counter start="1">
    Counting <slot data-bind="count">0</slot>
    <p data-bind="class.hidden=greater3">
      This is a really long text that's in the middle of the server component but
      is never included in the client-side JavaScript. If the count is 3 or greater,
      it's also hidden with a class.
    </p>
    <p data-bind="style.display=hideGreater3">
      If the count is 3 or greater, this is hidden with an inline style.
    </p>
    <div>
      <button data-onclick='dec'>-</button>
      <button data-onclick='inc'>+</button>
    </div>
  </my-counter>
  `
