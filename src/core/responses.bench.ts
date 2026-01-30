import "node:process";
import { assertEquals } from "jsr:@std/assert";
import { type Html, html } from "./html.ts";
import { htmlToResponse } from "./responses.ts";

/**
 * Howto run: https://docs.deno.com/runtime/reference/cli/bench/
 *
 * Setup a few relatively realistic components and benchmark them.
 */

const title = "Hello World";
const favicon = "/favicon.ico";
const Menu = () =>
  html`
    <nav>
      <ul></ul>
    </nav>
  `;

const Layout = (props: { children: Html; title: string }) =>
  html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${props.title}</title>
        <link rel="icon" href="${favicon}">
      </head>
      <body>
        ${Menu()}
        <main>${props.children}</main>
      </body>
    </html>
  `;

const widgets = [
  { title: "foo 1" },
  { title: "foo 2" },
  { title: "foo 3" },
  { title: "foo 4" },
  { title: "foo 5" },
];

async function* widgetsIterable() {
  for (const w of widgets) {
    yield html`<li>${w.title}</li>`;
  }
}

export const SyncPage = () =>
  htmlToResponse(
    Layout({
      children: html`
        <h1>${title}</h1>
        <ul>
          ${widgets.map((w) =>
            html`
              <li>${w.title}</li>
            `
          )}
        </ul>
      `,
      title,
    }),
  );

Deno.bench({
  name: "Sync htmlToResponse",
  async fn() {
    const res = SyncPage();
    assertEquals(await res.text(), [
      '',
      '    <!DOCTYPE html>',
      '    <html lang="en">',
      '      <head>',
      '        <meta charset="UTF-8">',
      '        <title>Hello World</title>',
      '        <link rel="icon" href="/favicon.ico">',
      '      </head>',
      '      <body>',
      '        ',
      '    <nav>',
      '      <ul></ul>',
      '    </nav>',
      '  ',
      '        <main>',
      '        <h1>Hello World</h1>',
      '        <ul>',
      '          ',
      '              <li>foo 1</li>',
      '            ',
      '              <li>foo 2</li>',
      '            ',
      '              <li>foo 3</li>',
      '            ',
      '              <li>foo 4</li>',
      '            ',
      '              <li>foo 5</li>',
      '            ',
      '        </ul>',
      '      </main>',
      '      </body>',
      '    </html>',
      '  ',
    ].join("\n"));
  },
});

Deno.bench({
  name: "htmlToResponse with Promises and AsyncIterables",
  async fn() {
    const res = htmlToResponse(
      Layout({
        children: html`
          <h1>${Promise.resolve(title)}</h1>
          <ul>
            ${widgetsIterable()}
          </ul>
        `,
        title,
      }),
    );
    assertEquals(await res.text(), [
      '',
      '    <!DOCTYPE html>',
      '    <html lang="en">',
      '      <head>',
      '        <meta charset="UTF-8">',
      '        <title>Hello World</title>',
      '        <link rel="icon" href="/favicon.ico">',
      '      </head>',
      '      <body>',
      '        ',
      '    <nav>',
      '      <ul></ul>',
      '    </nav>',
      '  ',
      '        <main>',
      '          <h1>Hello World</h1>',
      '          <ul>',
      '            <li>foo 1</li><li>foo 2</li><li>foo 3</li><li>foo 4</li><li>foo 5</li>',
      '          </ul>',
      '        </main>',
      '      </body>',
      '    </html>',
      '  ',
    ].join("\n"));
  },
});
