// deno-lint-ignore ban-types
type HtmlPrimitive = String | string | number | undefined | null;

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
 * import { html, renderToString } from "mastro/reactive";
 *
 * const myName = "World";
 * const myClass = "hero";
 *
 * const str = renderToString(
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
  return output;
};

/**
 * Mark a string as already properly escaped HTML. Do not use this on an untrusted/user-supplied string!
 *
 * This is similar to the DOM's [innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML#replacing_the_contents_of_an_element)
 * or React's `dangerouslySetInnerHTML`.
 */
export const unsafeInnerHtml = (str: string): Html =>
  // we're using a string object to mark something as HTML
  // (as opposed to a string that still needs to be escaped)
  // we could also use a plain object like `{ type: 'html', str }`
  // but the String object's `.toString()` and `.valueOf()` behaviour are handy.
  new String(str);

/**
 * Convert an `Html` node to a properly escaped `AsyncIterable<string>`.
 */
export async function* renderToStream(node: Html): AsyncIterable<string> {
  node = await node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      yield* renderToStream(node[i]);
    }
  } else if (isIterable(node)) {
    for await (const n of node) {
      yield* renderToStream(n);
    }
  } else {
    yield escape(node);
  }
}

/**
 * Convert an `Html` node to a properly escaped `Promise<string>`.
 */
export const renderToString = async (node: Html): Promise<string> =>
  typeof node !== "object" || node instanceof String
    ? escape(node)
    : (await Array.fromAsync(renderToStream(node))).join("");

const escape = (n: HtmlPrimitive): string =>
  typeof n === "string"
    ? escapeForAttribute(n)
    : (n === undefined || n === null ? "" : n.toString());

const escapeForHtml = (st: string) =>
  st.replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeForAttribute = (str: string) =>
  escapeForHtml(str)
    .replaceAll("'", "&#39;")
    .replaceAll('"', "&quot;");

// deno-lint-ignore no-explicit-any
const isIterable = <T>(val: any): val is AsyncIterable<T> =>
  val && typeof val[Symbol.asyncIterator] === "function";

const endsWithEq = (prev: Html) =>
  typeof prev === "object" &&
  typeof (prev as string)?.endsWith === "function" &&
  (prev as string).endsWith("=");

/**
 * `nrOf(str, char)` returns the number of times `char` occurs in `str`
 */
const nrOf = (str: string, char: string) => str.split(char).length - 1;
