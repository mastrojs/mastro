import { assertEquals } from 'jsr:@std/assert'
import { html, renderToStream, renderToString, unsafeInnerHtml } from './html.ts'
import { htmlResponse } from "./responses.ts";

Deno.test('html escaping', async () => {
  assertEquals(
    await renderToString(undefined),
    '',
  )
  assertEquals(
    await renderToString(null),
    '',
  )
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
})

Deno.test('html attributes', async () => {
  assertEquals(
    await renderToString(html`<div class="${'my class'}"></div>`),
    '<div class="my class"></div>',
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
})

Deno.test('htmlResponse', async () => {
  const res = htmlResponse(renderToStream('hi'))
  assertEquals(await res.text(), 'hi')

  const generator = async function* () {
    yield 'a'
    yield 'b'
    yield 'c'
  }
  const asyncRes = htmlResponse(renderToStream(html`hi ${generator()}`))
  assertEquals(await asyncRes.text(), 'hi abc')
})
