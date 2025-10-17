import { ReactiveElement, signal } from '@mastrojs/reactive'

customElements.define('simple-tabs', class extends ReactiveElement {
  activeTab = signal('home')

  switchTo (tab: string) {
    this.activeTab.set(tab)
  }

  isNotActiveTab (tab: string) {
    return tab !== this.activeTab()
  }
})
