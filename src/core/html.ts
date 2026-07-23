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
 * Note that we use `String` objects to store already properly escaped HTML.
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
  | Promise<Html>;

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
export const html = (templateParts: TemplateStringsArray, ...params: Html[]): Html[] => {
  let parts = cache.get(templateParts); // soon we can use cache.getOrInsertComputed
  if (!parts) cache.set(templateParts, parts = parseParts(templateParts));
  const output: Html[] = [];
  for (let i = 0; i < parts.length; i++) {
    const { html, quote } = parts[i];
    output.push(html);
    if (i < params.length) {
      const p = params[i];
      if (quote) {
        output.push(unsafeInnerHtml('"'), p, unsafeInnerHtml('"'));
      } else if (Array.isArray(p)) {
        output.push(...p);
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
export const unsafeInnerHtml = (val: string): HtmlPrimitive => Object.freeze(new String(val));

/**
 * Returns true iff `val` is an async iterable
 */
export const isAsyncIterable = <T>(val: any): val is AsyncIterable<T> =>
  val && typeof val[Symbol.asyncIterator] === "function";

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
 * Convert an `Html` node to a properly escaped `string` but
 * throws if the input contains a Promise or AsyncIterable.
 * You probably want to use `renderToString` or `renderToStream` instead.
 */
export const renderToStringSync = (node: Html): string => {
  const s = renderToStream(Array.isArray(node) ? node : [node]);
  if (typeof s !== "string") {
    throw Error("renderToStringSync received async value. Use renderToString instead.");
  }
  return s;
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

  // Set up buffer to reduce per-chunk overhead
  let buffer = "";
  const flushBuffer = () => {
    const value = buffer;
    buffer = "";
    return { value, done: false };
  };

  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          while (stack.length > 0) {
            const nextUp = stack[stack.length - 1];
            if (buffer.length > 0 &&
              (nextUp instanceof Promise || isAsyncIterable(nextUp) || isAsyncIterator(nextUp))) {
              return flushBuffer();
            }
            if (isAsyncIterator(nextUp)) {
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
                buffer += escape(current as HtmlPrimitive);
              }
            }
          }
          // stack is emptied
          return buffer.length > 0
            ? flushBuffer()
            : { value: undefined, done: true };
        },
      };
    },
  };
};

/**
 * Tests HTML snippets heuristically to determine whether we should wrap the next part in quotes
 * e.g. `<div class=${'myClass'}>`. We don't handle uppercase tags, HTML comments, or single-quoted
 * attributes, and track only whether we're in <script> contents (not <style> etc).
 */
const parseParts = (templateParts: TemplateStringsArray) => {
  let prefix = "";
  return templateParts.map((str) => {
    const scStart = (prefix += str).lastIndexOf("<script");
    const inScript = scStart > prefix.lastIndexOf("</script>") && prefix.indexOf(">", scStart) >= 0;
    const quote = !inScript && prefix.split('"').length % 2 === 1 &&
      openingTagWithAttr.test(prefix.slice(prefix.lastIndexOf(">") + 1));
    return { html: unsafeInnerHtml(str), quote };
  });
};
const openingTagWithAttr = /^\s*<[a-z][\w-]*(?:[^"'<>]|"[^"]*")*\s[\w:-]+=$/;

const escape = (n: HtmlPrimitive): string =>
  typeof n === "string"
    ? escapeForAttribute(n)
    : (n || typeof n === "number") ? n.toString() : "";

const escapeForAttribute = (str: string) =>
  needsEscaping.test(str)
    ? str.replace(/[&<>'"]/g, (char) => chars[char as keyof typeof chars])
    : str;
const needsEscaping = /[&<>'"]/;
const chars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };

const isAsyncIterator = <T>(val: any): val is AsyncIterator<T> =>
  val && typeof val.next === "function";

const cache = new Map<TemplateStringsArray, { html: HtmlPrimitive; quote: boolean }[]>();
