import assert from "node:assert/strict";
import { bench } from "node:bench";
import "node:process";
import { type Html, html } from "./html.ts";
import { htmlToResponse, sseResponse } from "./responses.ts";

const OPS_PER_SAMPLE = 100;
export const runBench = (name: string, fn: () => Promise<void>): ReturnType<bench> =>
  bench(name, async (b) => {
    b.start();
    for (let i = 0; i < OPS_PER_SAMPLE; i++) await fn();
    b.end(OPS_PER_SAMPLE);
  });

/**
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

export const SyncPage = (): Response =>
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

runBench(
  "Sync htmlToResponse",
  async () => {
    const res = SyncPage();
    assert.deepEqual(await res.text(), [
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
);

runBench(
  "htmlToResponse with Promises and AsyncIterables",
  async () => {
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
    assert.deepEqual(await res.text(), [
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
  }
);

runBench(
  "sseResponse",
  async () => {
    const length = 20;
    async function* generator() {
      let i = 0;
      while (i < length) {
        yield { i };
        i++;
      }
    }
    const res = sseResponse(generator());
    const arr = Array.from({ length }, (_, i) => `data: {"i":${i}}`);
    assert.deepEqual(await res.text(), arr.join("\n\n") + "\n\n");
  },
);
