import { assert, assertEquals } from 'jsr:@std/assert'
import { type Html, html, renderToStream, renderToString, renderToStringSync, unsafeInnerHtml } from './html.ts'
import { htmlToResponse } from "./responses.ts";

Deno.test("html", async () => {
  assertEquals(
    await renderToString(html`<p>hi</p>`),
    "<p>hi</p>",
  )
  assertEquals(
    await renderToString(" hi "),
    " hi ",
  )
  const items: string[] = [];
  assertEquals(
    await renderToString(items.length > 0 && items),
    "",
  )
  assertEquals(
    await renderToString(undefined),
    "",
  )
  assertEquals(
    await renderToString(null),
    "",
  )
  assertEquals(
    await renderToString(0),
    "0",
  )
});

Deno.test('html escaping', async () => {
  assertEquals(
    await renderToString('foo & <strong>bar</strong>'),
    'foo &amp; &lt;strong&gt;bar&lt;/strong&gt;',
  )
  assertEquals(
    await renderToString(html`<div>${'foo & <strong>bar</strong>'}</div>`),
    '<div>foo &amp; &lt;strong&gt;bar&lt;/strong&gt;</div>',
  )
  assertEquals(
    await renderToString(html`<div>${['foo', ' & ', '<strong>bar</strong>']}</div>`),
    '<div>foo &amp; &lt;strong&gt;bar&lt;/strong&gt;</div>',
  )
  const promise = Promise.resolve('foo & <strong>bar</strong>')
  assertEquals(
    await renderToString(html`<div>${promise}</div>`),
    '<div>foo &amp; &lt;strong&gt;bar&lt;/strong&gt;</div>',
  )
  const promiseArr = Promise.resolve(['foo', ' & ', '<strong>bar</strong>'])
  assertEquals(
    await renderToString(html`<div>${promiseArr}</div>`),
    '<div>foo &amp; &lt;strong&gt;bar&lt;/strong&gt;</div>',
  )
  assertEquals(
    await renderToString(unsafeInnerHtml('foo <strong>bar</strong>')),
    'foo <strong>bar</strong>',
  )
  assertEquals(
    await renderToString(['&', '&']),
    '&amp;&amp;',
  )
})

Deno.test('html attributes with automatic quote insertion', async () => {
  assertEquals(
    await renderToString(html`<div class="${'my class'}"></div>`),
    '<div class="my class"></div>',
  )
  assertEquals(
    await renderToString(html`<div class= ${'my class'}></div>`),
    '<div class= my class></div>',
  )
  assertEquals(
    await renderToString(html`<div class="${'my"class'}"></div>`),
    '<div class="my&quot;class"></div>',
  )
  assertEquals(
    await renderToString(html`<div class=${'my class'}></div>`),
    '<div class="my class"></div>',
  )
  assertEquals(
    await renderToString(html`<input required="" class=${'my class'}>`),
    '<input required="" class="my class">',
  )
  assertEquals(
    await renderToString(html`<input required=${'required'} class=${'my class'}>`),
    '<input required="required" class="my class">',
  )
  assertEquals(
    await renderToString(html`<code>x=${7}</code>`),
    '<code>x=7</code>',
  )
  assertEquals(
    await renderToString(html`<input ${'required'}><code>x=${7}</code>`),
    '<input required><code>x=7</code>',
  )
  assertEquals(
    await renderToString(html`<div ${'required'} ${'foo'}></div><code>x=${7}</code>`),
    '<div required foo></div><code>x=7</code>',
  )
  assertEquals(
    await renderToString(html`<div class=${['my', ' class']}></div>`),
    '<div class="my class"></div>',
  )
  assertEquals(
    await renderToString(html`<h1 class=${'my class'}></h1>`),
    '<h1 class="my class"></h1>',
  )
  assertEquals(
    await renderToString(html`<my-element
      class=${'my class'}></my-element>`),
    '<my-element\n      class="my class"></my-element>',
  )
})

Deno.test("html automatic quote insertion: does not trigger in script contents", async () => {
  assertEquals(
    await renderToString(html`<script>if (a < b) x=${7}</script>`),
    "<script>if (a < b) x=7</script>",
  );
  assertEquals(
    await renderToString(html`<script type="module">if (a < b) x=${7}</script>`),
    '<script type="module">if (a < b) x=7</script>',
  );
  assertEquals(
    await renderToString(html`<script>if (a<b) x=${7}</script>`),
    "<script>if (a<b) x=7</script>",
  );
  assertEquals(
    await renderToString(
      html`<script type=${"module"}>// Create a <div dynamically
const count=${7};</script><div class="${"after"}"></div>`,
    ),
    '<script type="module">// Create a <div dynamically\nconst count=7;</script><div class="after"></div>',
  );
  assertEquals(
    await renderToString(
      html`<script data-code="a > b">// Create a <div dynamically
const count=${7};</script>`,
    ),
    '<script data-code="a > b">// Create a <div dynamically\nconst count=7;</script>',
  );
  assertEquals(
    await renderToString(html`<script src=${"app.js"}></script><div class=${"after"}></div>`),
    '<script src="app.js"></script><div class="after"></div>',
  );
  assertEquals(
    await renderToString(html`<script src=${"app.js"} type="module"></script><div class=${"after"}></div>`),
    '<script src="app.js" type="module"></script><div class="after"></div>',
  );
});

Deno.test("html automatic quote insertion: does not trigger in style contents", async () => {
  assertEquals(
    await renderToString(html`<style type="text/css">.box > h1 { color: ${"red"}; }</style>`),
    '<style type="text/css">.box > h1 { color: red; }</style>',
  );
  assertEquals(
    await renderToString(html`<style>.box > h1 { margin: ${0}; }</style><div class=${"after"}></div>`),
    '<style>.box > h1 { margin: 0; }</style><div class="after"></div>',
  );
});

Deno.test("html does not falsely add quotes around attribute-like text", async () => {
  assertEquals(
    await renderToString(html`some class=${"text"}`),
    "some class=text",
  );
  assertEquals(
    await renderToString(html`<p>some class=${"text"}</p>`),
    "<p>some class=text</p>",
  );
  assertEquals(
    await renderToString(html`<!-- <div class=${"comment"}> -->`),
    "<!-- <div class=comment> -->",
  );
  assertEquals(
    await renderToString(html`<div title='not class=${"not an attribute"}'></div>`),
    "<div title='not class=not an attribute'></div>",
  );
  assertEquals(
    await renderToString(html`<div title="not class=${"not an attribute"}"></div>`),
    '<div title="not class=not an attribute"></div>',
  );
  assertEquals(
    await renderToString(html`<div title="a > <span class=${"not an attribute"}"></div>`),
    '<div title="a > <span class=not an attribute"></div>',
  );
  assertEquals(
    await renderToString(html`<div class==${"not an attribute"}></div>`),
    "<div class==not an attribute></div>",
  );
  assertEquals(
    await renderToString(html`<script>const example = "<div class=${"script"}>";</script>`),
    '<script>const example = "<div class=script>";</script>',
  );
  assertEquals(
    await renderToString(html`<script>const x = "<div class=${'foo'}"</script>`),
    '<script>const x = "<div class=foo"</script>',
  );
  assertEquals(
    await renderToString(html`<script>code</scripture><div class=${"script"}`),
    "<script>code</scripture><div class=script",
  );
});

Deno.test(
  "html currently does not add quotes in cases where a more complex implementation would",
  async () => {
    assertEquals(
      await renderToString(html`<DIV class=${"uppercase"}></DIV>`),
      "<DIV class=uppercase></DIV>",
    );
    assertEquals(
      await renderToString(html`<div title="a > b" class=${'myClass'}></div>`),
      '<div title="a > b" class=myClass></div>',
    )
    assertEquals(
      await renderToString(html`<div title="<script>" class=${'after'}></div>`),
      '<div title="<script>" class=after></div>',
    )
  },
);

Deno.test("html caches immutable template strings", async () => {
  const Component = (value: string) => html`<p class=${value}>${value}</p>`;
  const first = Component("first");
  const second = Component("second");

  assert(first !== second);
  assert(first[0] === second[0]);
  assert(Object.isFrozen(first[0]));
  first[0] = "changed";
  assertEquals(await renderToString(second), '<p class="second">second</p>');
  assertEquals(await renderToString(Component("third")), '<p class="third">third</p>');
});

Deno.test("renderToStringSync", () => {
  assertEquals(
    renderToStringSync("text"),
    "text",
  );
  assertEquals(
    renderToStringSync(html`<p>hi</p>`),
    "<p>hi</p>",
  );
});

Deno.test("html with Promises", async () => {
  assertEquals(
    await renderToString(html`<p>${Promise.resolve("hi")}</p>`),
    "<p>hi</p>",
  );

  const headings = Promise.resolve(["foo", "bar"]);
  assertEquals(
    await renderToString(html`<ol>${headings.then(hs => hs.map(h => html`<li>${h}</li>`))}</ol>`),
    "<ol><li>foo</li><li>bar</li></ol>",
  );
})

Deno.test("renderToStream buffers sync content and flushes before async work", async () => {
  async function* gen() {
    yield "d";
    yield "e";
  }

  const stream = renderToStream(html`a${Promise.resolve("b")}c${gen()}f`);
  assert(typeof stream !== "string");
  assertEquals(await Array.fromAsync(stream), ["a", "bc", "d", "e", "f"]);
});

Deno.test('htmlResponse', async () => {
  const res = htmlToResponse('hi')
  assertEquals(await res.text(), 'hi')

  const generator = async function* () {
    yield 'a'
    yield 'b'
    yield 'c'
  }
  const iteratorRes = htmlToResponse(html`hi ${generator()}`)
  assertEquals(await iteratorRes.text(), 'hi abc')

  const iterableRes = htmlToResponse(html`hi ${createAsyncIterable("there")}`)
  assertEquals(await iterableRes.text(), "hi there")
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
