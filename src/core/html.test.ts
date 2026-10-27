import assert from "node:assert/strict";
import { test } from "node:test";
import { type Html, html, renderToStream, renderToString, renderToStringSync, unsafeInnerHtml } from './html.ts'
import { htmlToResponse } from "./responses.ts";

test("html", async () => {
  assert.deepEqual(
    await renderToString(html`<p>hi</p>`),
    "<p>hi</p>",
  )
  assert.deepEqual(
    await renderToString(" hi "),
    " hi ",
  )
  const items: string[] = [];
  assert.deepEqual(
    await renderToString(items.length > 0 && items),
    "",
  )
  assert.deepEqual(
    await renderToString(undefined),
    "",
  )
  assert.deepEqual(
    await renderToString(null),
    "",
  )
  assert.deepEqual(
    await renderToString(0),
    "0",
  )
});

test('html escaping', async () => {
  assert.deepEqual(
    await renderToString('foo & <strong>bar</strong>'),
    'foo &amp; &lt;strong&gt;bar&lt;/strong&gt;',
  )
  assert.deepEqual(
    await renderToString(html`<div>${'foo & <strong>bar</strong>'}</div>`),
    '<div>foo &amp; &lt;strong&gt;bar&lt;/strong&gt;</div>',
  )
  assert.deepEqual(
    await renderToString(html`<div>${['foo', ' & ', '<strong>bar</strong>']}</div>`),
    '<div>foo &amp; &lt;strong&gt;bar&lt;/strong&gt;</div>',
  )
  const promise = Promise.resolve('foo & <strong>bar</strong>')
  assert.deepEqual(
    await renderToString(html`<div>${promise}</div>`),
    '<div>foo &amp; &lt;strong&gt;bar&lt;/strong&gt;</div>',
  )
  const promiseArr = Promise.resolve(['foo', ' & ', '<strong>bar</strong>'])
  assert.deepEqual(
    await renderToString(html`<div>${promiseArr}</div>`),
    '<div>foo &amp; &lt;strong&gt;bar&lt;/strong&gt;</div>',
  )
  assert.deepEqual(
    await renderToString(unsafeInnerHtml('foo <strong>bar</strong>')),
    'foo <strong>bar</strong>',
  )
  assert.deepEqual(
    await renderToString(['&', '&']),
    '&amp;&amp;',
  )
})

test('html attributes with automatic quote insertion', async () => {
  assert.deepEqual(
    await renderToString(html`<div class="${'my class'}"></div>`),
    '<div class="my class"></div>',
  )
  assert.deepEqual(
    await renderToString(html`<div class= ${'my class'}></div>`),
    '<div class= my class></div>',
  )
  assert.deepEqual(
    await renderToString(html`<div class="${'my"class'}"></div>`),
    '<div class="my&quot;class"></div>',
  )
  assert.deepEqual(
    await renderToString(html`<div class=${'my class'}></div>`),
    '<div class="my class"></div>',
  )
  assert.deepEqual(
    await renderToString(html`<input required="" class=${'my class'}>`),
    '<input required="" class="my class">',
  )
  assert.deepEqual(
    await renderToString(html`<input required=${'required'} class=${'my class'}>`),
    '<input required="required" class="my class">',
  )
  assert.deepEqual(
    await renderToString(html`<code>x=${7}</code>`),
    '<code>x=7</code>',
  )
  assert.deepEqual(
    await renderToString(html`<input ${'required'}><code>x=${7}</code>`),
    '<input required><code>x=7</code>',
  )
  assert.deepEqual(
    await renderToString(html`<div ${'required'} ${'foo'}></div><code>x=${7}</code>`),
    '<div required foo></div><code>x=7</code>',
  )
  assert.deepEqual(
    await renderToString(html`<div class=${['my', ' class']}></div>`),
    '<div class="my class"></div>',
  )
  assert.deepEqual(
    await renderToString(html`<h1 class=${'my class'}></h1>`),
    '<h1 class="my class"></h1>',
  )
  assert.deepEqual(
    await renderToString(html`<my-element
      class=${'my class'}></my-element>`),
    '<my-element\n      class="my class"></my-element>',
  )
})

test("html automatic quote insertion: does not trigger in script contents", async () => {
  assert.deepEqual(
    await renderToString(html`<script>if (a < b) x=${7}</script>`),
    "<script>if (a < b) x=7</script>",
  );
  assert.deepEqual(
    await renderToString(html`<script type="module">if (a < b) x=${7}</script>`),
    '<script type="module">if (a < b) x=7</script>',
  );
  assert.deepEqual(
    await renderToString(html`<script>if (a<b) x=${7}</script>`),
    "<script>if (a<b) x=7</script>",
  );
  assert.deepEqual(
    await renderToString(
      html`<script type=${"module"}>// Create a <div dynamically
const count=${7};</script><div class="${"after"}"></div>`,
    ),
    '<script type="module">// Create a <div dynamically\nconst count=7;</script><div class="after"></div>',
  );
  assert.deepEqual(
    await renderToString(
      html`<script data-code="a > b">// Create a <div dynamically
const count=${7};</script>`,
    ),
    '<script data-code="a > b">// Create a <div dynamically\nconst count=7;</script>',
  );
  assert.deepEqual(
    await renderToString(html`<script src=${"app.js"}></script><div class=${"after"}></div>`),
    '<script src="app.js"></script><div class="after"></div>',
  );
  assert.deepEqual(
    await renderToString(html`<script src=${"app.js"} type="module"></script><div class=${"after"}></div>`),
    '<script src="app.js" type="module"></script><div class="after"></div>',
  );
});

test("html automatic quote insertion: does not trigger in style contents", async () => {
  assert.deepEqual(
    await renderToString(html`<style type="text/css">.box > h1 { color: ${"red"}; }</style>`),
    '<style type="text/css">.box > h1 { color: red; }</style>',
  );
  assert.deepEqual(
    await renderToString(html`<style>.box > h1 { margin: ${0}; }</style><div class=${"after"}></div>`),
    '<style>.box > h1 { margin: 0; }</style><div class="after"></div>',
  );
});

test("html does not falsely add quotes around attribute-like text", async () => {
  assert.deepEqual(
    await renderToString(html`some class=${"text"}`),
    "some class=text",
  );
  assert.deepEqual(
    await renderToString(html`<p>some class=${"text"}</p>`),
    "<p>some class=text</p>",
  );
  assert.deepEqual(
    await renderToString(html`<!-- <div class=${"comment"}> -->`),
    "<!-- <div class=comment> -->",
  );
  assert.deepEqual(
    await renderToString(html`<div title='not class=${"not an attribute"}'></div>`),
    "<div title='not class=not an attribute'></div>",
  );
  assert.deepEqual(
    await renderToString(html`<div title="not class=${"not an attribute"}"></div>`),
    '<div title="not class=not an attribute"></div>',
  );
  assert.deepEqual(
    await renderToString(html`<div title="a > <span class=${"not an attribute"}"></div>`),
    '<div title="a > <span class=not an attribute"></div>',
  );
  assert.deepEqual(
    await renderToString(html`<div class==${"not an attribute"}></div>`),
    "<div class==not an attribute></div>",
  );
  assert.deepEqual(
    await renderToString(html`<script>const example = "<div class=${"script"}>";</script>`),
    '<script>const example = "<div class=script>";</script>',
  );
  assert.deepEqual(
    await renderToString(html`<script>const x = "<div class=${'foo'}"</script>`),
    '<script>const x = "<div class=foo"</script>',
  );
  assert.deepEqual(
    await renderToString(html`<script>code</scripture><div class=${"script"}`),
    "<script>code</scripture><div class=script",
  );
});

test(
  "html currently does not add quotes in cases where a more complex implementation would",
  async () => {
    assert.deepEqual(
      await renderToString(html`<DIV class=${"uppercase"}></DIV>`),
      "<DIV class=uppercase></DIV>",
    );
    assert.deepEqual(
      await renderToString(html`<div title="a > b" class=${'myClass'}></div>`),
      '<div title="a > b" class=myClass></div>',
    )
    assert.deepEqual(
      await renderToString(html`<div title="<script>" class=${'after'}></div>`),
      '<div title="<script>" class=after></div>',
    )
  },
);

test("html caches immutable template strings", async () => {
  const Component = (value: string) => html`<p class=${value}>${value}</p>`;
  const first = Component("first");
  const second = Component("second");

  assert(first !== second);
  assert(first[0] === second[0]);
  assert(Object.isFrozen(first[0]));
  first[0] = "changed";
  assert.deepEqual(await renderToString(second), '<p class="second">second</p>');
  assert.deepEqual(await renderToString(Component("third")), '<p class="third">third</p>');
});

test("renderToStringSync", () => {
  assert.deepEqual(
    renderToStringSync("text"),
    "text",
  );
  assert.deepEqual(
    renderToStringSync(html`<p>hi</p>`),
    "<p>hi</p>",
  );
});

test("html with Promises", async () => {
  assert.deepEqual(
    await renderToString(html`<p>${Promise.resolve("hi")}</p>`),
    "<p>hi</p>",
  );

  const headings = Promise.resolve(["foo", "bar"]);
  assert.deepEqual(
    await renderToString(html`<ol>${headings.then(hs => hs.map(h => html`<li>${h}</li>`))}</ol>`),
    "<ol><li>foo</li><li>bar</li></ol>",
  );
})

test("renderToStream buffers sync content and flushes before async work", async () => {
  async function* gen() {
    yield "d";
    yield "e";
  }

  const stream = renderToStream(html`a${Promise.resolve("b")}c${gen()}f`);
  assert(typeof stream !== "string");
  assert.deepEqual(await Array.fromAsync(stream), ["a", "bc", "d", "e", "f"]);
});

test('htmlResponse', async () => {
  const res = htmlToResponse('hi')
  assert.deepEqual(await res.text(), 'hi')

  const generator = async function* () {
    yield 'a'
    yield 'b'
    yield 'c'
  }
  const iteratorRes = htmlToResponse(html`hi ${generator()}`)
  assert.deepEqual(await iteratorRes.text(), 'hi abc')

  const iterableRes = htmlToResponse(html`hi ${createAsyncIterable("there")}`)
  assert.deepEqual(await iterableRes.text(), "hi there")
})

/**
 * Creates an `AsyncIterable<T>`, which (unlike the generator) is not an `AsyncIterator`
 */
const createAsyncIterable = <T>(value: T): AsyncIterable<T> => ({
  [Symbol.asyncIterator]() {
    let done = false;
    return {
      // deno-lint-ignore require-await
      next: async () => {
        if (done) {
          return { value: undefined, done };
        } else {
          done = true;
          return { value, done: false };
        }
      }
    };
  }
});
