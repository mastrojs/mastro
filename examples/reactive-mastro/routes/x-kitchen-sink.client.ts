import { computed, html, ReactiveElement, signal } from '@mastrojs/reactive'

customElements.define('tab-switch', class extends ReactiveElement {
  userName = signal<string | undefined>(undefined)
  tabName = signal('profile')

  renderTab = computed(() => {
    switch(this.tabName()) {
      case 'home': return html`
        <h3>Home</h3>
        <p>My home is my castle.</p>
        `
      case 'profile': return html`
        <h3>Profile</h3>
        <label>
          User name
          <input data-onchange="setUserName">
          <user-info company="Octan" data-bind="props.name=userName; props.tabName=tabName">
          </user-info>
        </label>
        `
      case 'settings': return html`
        <h3>Profile</h3>
        <p>Nothing to tune?!</p>
        `
    }
  })

  initialHtml () {
    return html`
      <p>Logged in as <slot data-bind="userName"></slot>.</p>

      <button data-onclick="switchTo('home')">Home</button>
      <button data-onclick="switchTo('profile')">Profile</button>
      <button data-onclick="switchTo('settings')">Settings</button>

      <div data-bind="renderTab"></div>
    `
  }

  setUserName (e: Event) {
    const { value } = e.target as HTMLInputElement
    this.userName.set(value)
  }

  switchTo (tabName: string) {
    this.tabName.set(tabName)
  }
})

customElements.define('user-info', class extends ReactiveElement {
  initialHtml () {
    return html`
      <div>Company: ${this.getAttribute('company')}</div>
      <div>Company: <slot data-bind="company"></slot></div>
      <div>Name: <slot data-bind="name"></slot></div>
      <div>Tab name: <slot data-bind="tabName"></slot></div>
      `
  }
})
