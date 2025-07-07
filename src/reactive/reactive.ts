/**
 * This module contains [Reactive Mastro](https://mastrojs.github.io/reactive/)
 * – a tiny reactive GUI library that runs in your browser.
 * @module
 */

import * as signals from '@maverick-js/signals'
import { renderToString } from '../html.ts'
import { parseArgs, parseBind } from "./reactive.util.ts";

export * from '../html.ts'
/**
 * Creates a new signal whose value is computed and returned by the given function.
 * The given compute function is only re-run when one of its dependencies are updated.
 *
 * See [@maverick-js/signals#computed](https://github.com/maverick-js/signals#computed)
 */
export const computed = signals.computed

/**
 * Invokes the given function each time any of the signals that are read inside are updated (i.e., their value changes)
 *
 * See [@maverick-js/signals#computed](https://github.com/maverick-js/signals#effect)
 */
export const effect = signals.effect

/**
 * Wraps the given value into a signal.
 *
 * See [@maverick-js/signals#computed](https://github.com/maverick-js/signals#signal)
 */
export const signal = signals.signal

if (typeof HTMLElement !== "function") {
  // if this module happens to get imported server-side,
  // this hack avoids it from crashing on import
  globalThis.HTMLElement = class Foo {} as any
}

/**
 * Base class for reactive elements. Extends [HTMLElement](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements).
 * For usage, see the [Reactive Mastro website](https://mastrojs.github.io/reactive/).
 */
export class ReactiveElement extends HTMLElement {
  #dispose?: signals.Dispose
  /** override this field in your class constructor as necessary */
  #eventNames = ['click', 'change', 'input', 'submit']

  async connectedCallback () {
    if (this.#dispose) {
      // connectedCallback is also called when custom element is moved,
      // but we want to run the setup only once
      return
    }

    this.#eventNames.forEach(eventName =>
      // to support events on elements that are added after custom element creation,
      // we add a listener to the custom element for each common event name and let the event bubble up there
      (this.shadowRoot || this).addEventListener(eventName, e => {
        const { target } = e
        const value = target && target instanceof HTMLElement
          ? target.dataset['on' + eventName]
          : undefined
        if (value) {
          e.stopPropagation()
          const [methodName, rawArgs] = value.split('(')
          const args = parseArgs(rawArgs)
          // @ts-ignore noImplicitAny
          if (typeof this[methodName] === 'function') {
            // @ts-ignore noImplicitAny
            this[methodName](...args, e)
          } else {
            console.warn(`${this.nodeName.toLowerCase()}#${methodName.toString()} is not a function`)
          }
        }
      })
    )

    // @ts-ignore key initialHtml does not exist
    if (typeof this.initialHtml === 'function' && !this.innerHTML.trim()) {
      (this.shadowRoot || this).innerHTML = await renderToString(
        // @ts-ignore key initialHtml does not exist
        this.initialHtml()
      )
    }

    for (const attr of this.attributes) {
      if (!attr.name.startsWith('data-')) {
        // in order to have a uniform interface for component props,
        // we create signals from static attributes and assign them to fields
        // @ts-ignore noImplicitAny
        this[attr.name] = () => attr.value
      }
    }

    setTimeout(() => {
      signals.root(dispose => {
        this.#dispose = dispose

        const registerRenderingEffects = (rootEl: Element | ShadowRoot) => {
          for (const el of rootEl.querySelectorAll(`[data-bind]`)) {
            if (el instanceof HTMLElement && !isChildOfOtherCustomElement(rootEl, el)) {
              for (const bind of el.dataset.bind?.split(';') || []) {
                const { error, prop, subprop, fieldOrMethod, args } = parseBind(bind)
                if (error) {
                  console.warn(error, el)
                // @ts-ignore noImplicitAny
                } else if (typeof this[fieldOrMethod] !== 'function') {
                  console.warn(`${this.nodeName.toLowerCase()}#${fieldOrMethod
                    } is not a signal or method`, el)
                } else {
                  effect(() => {
                    // @ts-ignore noImplicitAny
                    const val = this[fieldOrMethod](...args)
                    if (prop === 'class' && subprop) {
                      // e.g. data-bind="class.myClass = myField"
                      el.classList[val ? 'add' : 'remove'](subprop)
                    } else if (prop === 'props' && subprop) {
                      // e.g. data-bind="props.myChildField = myParentField"
                      // @ts-ignore noImplicitAny
                      el[subprop] = this[fieldOrMethod]
                    } else if (subprop) {
                      // e.g. data-bind="dataset.myKey = myField"
                      // @ts-ignore noImplicitAny
                      el[prop][subprop] = val
                    } else if (prop === 'innerHTML') {
                      // e.g. data-bind="myField"
                      renderToString(val).then(v => {
                        el[prop] = v
                        registerRenderingEffects(el)
                      })
                    } else {
                      // e.g. data-bind="required = myField"
                      // @ts-ignore noImplicitAny
                      el[prop] = val
                    }
                  })
                }
              }
            }
          }
        }
        registerRenderingEffects(this.shadowRoot || this)
      })
    })
  }

  disconnectedCallback () {
    this.#dispose?.()
  }
}

const isChildOfOtherCustomElement = (rootEl: Element | ShadowRoot, el: Element) => {
  let p = el.parentElement
  while (p && p !== rootEl) {
    if (p.nodeName.includes('-')) {
      return true
    }
    p = p.parentElement
  }
}
