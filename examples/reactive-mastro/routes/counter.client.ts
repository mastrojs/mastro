import { computed, html, ReactiveElement, signal } from '@mastrojs/reactive'

customElements.define('my-counter', class extends ReactiveElement {
  count = signal(parseInt(this.getAttribute('start') || '0', 10))
  greater3 = computed(() => this.count() >= 3)
  hideGreater3 = computed(() => this.count() >= 3 ? 'none' : '')

  initialHtml () {
    return html`
      Counting <slot data-bind="count">0</slot>
      <button data-onclick='inc'>+</button>
    `
  }

  dec () {
    this.count.set(c => c - 1)
  }

  inc () {
    this.count.set(c => c + 1)
  }
})
