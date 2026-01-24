/**
 * `@mastrojs/mastro/html` contains a selfcontained way to construct and properly escape
 * HTML using JavaScript tagged template literals.
 * All its exports are also exported by the default `@mastrojs/mastro` module,
 * and usually you should just use those. However, it is also exported separately here
 * for use in `@mastrojs/reactive` or other projects where you only want its functionality.
 * @module
 */

/**
 * HTML primitive values like strings and numbers.
 *
 * Note that we use [`String` objects](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)
 * to store already properly escaped HTML.
 */
// deno-lint-ignore ban-types
export type HtmlPrimitive = String | string | number | undefined | null | false;

/**
 * An `Html` node – i.e. what can be used with `html` tagged templates.
 */
export type Html =
  | HtmlPrimitive
  | Html[]
  | AsyncIterable<Html>
  | Promise<HtmlPrimitive>
  | Promise<Html[]>;

/**
 * Tagged template literal to construct `Html` nodes.
 * This makes sure things are properly escaped (unless `unsafeInnerHtml` is used).
 *
 * ```ts
 * import { html, renderToString } from "@mastrojs/mastro";
 *
 * const myName = "World";
 * const myClass = "hero";
 *
 * const str = await renderToString(
 *   html`<h1 class=${myClass}>Hello ${myName}</h1>`
 * );
 * ```
 */
export const html = (strings: TemplateStringsArray, ...params: Html[]): Html[] => {
  const output: Html[] = [];
  let insideTag = false;
  for (let i = 0; i < strings.length; i++) {
    const str = strings[i];
    output.push(unsafeInnerHtml(str));
    insideTag = (insideTag ? 1 : 0) + nrOf(str, "<") - nrOf(str, ">") === 1;
    if (i < params.length) {
      const p = params[i];
      if (Array.isArray(p)) {
        output.push(...p);
      } else if (insideTag && endsWithEq(output.at(-1))) {
        // add quotes around attribute for e.g. html`<div class=${'my class'}></div>`
        output.push(unsafeInnerHtml('"'), p, unsafeInnerHtml('"'));
      } else {
        output.push(p);
      }
    }
  }
  return output;
};

/**
 * Mark a string as already properly escaped HTML. Do not use this on an untrusted/user-supplied string!
 *
 * This is similar to the DOM's [innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML#replacing_the_contents_of_an_element)
 * or React's `dangerouslySetInnerHTML`.
 */
export const unsafeInnerHtml = (str: string): Html =>
  // Alternatively, we could also use a plain object like `{ type: 'html', str }`
  // but the String object's `.toString()` and `.valueOf()` behaviour are handy.
  new String(str);

/**
 * Convert an `Html` node to a properly escaped `Promise<string>`.
 *
 * See `renderToStream` for a more efficient but less ergonomic alternative.
 */
export const renderToString = async (node: Html): Promise<string> => {
  const s = renderToStream(node);
  return typeof s === "string" ? s : (await Array.fromAsync(s)).join("");
}

/**
 * Convert an `Html` node to a properly escaped stream.
 * Returns an `AsyncIterable<string>` if there are Promises or AsyncIterables in the input,
 * otherwise returns a `string`.
 *
 * The string case is a lot more efficient – especially when then passed to
 * Mastro's `htmlResponse`, to construct a `Response`.
 */
export const renderToStream = (node: Html): string | AsyncIterable<string> => {
  let stack: Array<Html | AsyncIterator<Html>> = [node];
  if (Array.isArray(node)) {
    stack = node.flat(Infinity as 1);
    if (!(stack.some((n) => n instanceof Promise || isAsyncIterable(n)))) {
      // if there is nothing async, we can speed things up by an order of magnitude like this
      let str = "";
      for (let i = 0; i < stack.length; i++) {
        // in my limited testing, this is faster than `stack.map(escape).join("")`
        str += escape(stack[i] as HtmlPrimitive);
      }
      return str;
    }
  }

  // reversing and using pop() is faster than using shift().
  // However, we could investigate whether keeping a manual index would be better,
  // but garbage collection would probably suffer.
  stack.reverse();
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          while (stack.length > 0) {
            const nextUp = stack[stack.length - 1];
            if (typeof nextUp === "object" && nextUp !== null && "next" in nextUp) {
              // If an iterator is on top of the stack, consume its next element.
              // But only pop the iterator itself from the stack when it's done.
              const { value, done } = await nextUp.next();
              if (done) {
                stack.pop();
              } else {
                stack.push(value);
              }
            } else {
              const current = await stack.pop();
              if (Array.isArray(current)) {
                for (let i = current.length - 1; i >= 0; i--) {
                  stack.push(current[i]);
                }
              } else if (isAsyncIterable(current)) {
                // push iterator on stack for future consumption
                const iterator = current[Symbol.asyncIterator]();
                stack.push(iterator);
              } else {
                return { value: escape(current as HtmlPrimitive), done: false };
              }
            }
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
};

const escape = (n: HtmlPrimitive): string =>
  typeof n === "string"
    ? escapeForAttribute(n)
    : (n || typeof n === "number") ? n.toString() : "";

const escapeForHtml = (st: string) =>
  st.replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeForAttribute = (str: string) =>
  escapeForHtml(str)
    .replaceAll("'", "&#39;")
    .replaceAll('"', "&quot;");

const isAsyncIterable = <T>(val: any): val is AsyncIterable<T> =>
  val && typeof val[Symbol.asyncIterator] === "function";

const endsWithEq = (prev: Html) =>
  typeof prev === "object" &&
  typeof (prev as string)?.endsWith === "function" &&
  (prev as string).endsWith("=");

/**
 * `nrOf(str, char)` returns the number of times `char` occurs in `str`
 */
const nrOf = (str: string, char: string) => str.split(char).length - 1;
