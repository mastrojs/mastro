# Reactive Mastro

A tiny (2.7kB minzipped) reactive GUI library for your existing MPA. Reactive Mastro sits somewhere in between React/Vue/Solid/Svelte one one end, and Alpine/HTMX/Stimulus on the other end – while being smaller and simpler than all of them.

Reactive Mastro was conceived as the client-side part of [Mastro](https://mastrojs.github.io/), but you can just as well use it with any other static site or server that renders HTML (such as Rails, Django, PHP, etc).

Learn more about **[Reactive Mastro](https://mastrojs.github.io/reactive/)**


## Install

    pnpm add @mastrojs/reactive

You can also use a CDN. See [Installing Reactive Mastro](https://mastrojs.github.io/reactive/install/).


## Usage

Server-side part is plain HTML:

```html
<my-counter>
  Count is <span data-bind="count">0</span>
  <button data-onclick="inc">Click me</button>
</my-counter>
```

Client-side part is plain JavaScript:

```js
import { ReactiveElement, signal } from "https://cdn.jsdelivr.net/npm/@mastrojs/reactive@0.4.4/dist/reactive.min.js";

customElements.define("my-counter", class extends ReactiveElement {
  count = signal(0)

  inc () {
    this.count.set(c => c + 1)
  }
})
```

To learn more, read [Using Reactive Mastro](https://mastrojs.github.io/reactive/usage/).
