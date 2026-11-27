import assert from "node:assert/strict";
import "node:process";
import { html } from "./html.ts";
import { htmlToResponse, sseResponse } from "./responses.ts";
import { Layout, runBench, SyncPage, title, widgetsIterable } from "../shared.bench.helpers.ts";

runBench("Sync htmlToResponse", {
  opsPerSample: 100,
  fn: async () => {
    const res = SyncPage();
    return res.text();
  },
  validate: (text) => {
    assert.deepEqual(text, [
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

runBench("htmlToResponse with Promises and AsyncIterables", {
  opsPerSample: 100,
  fn: async () => {
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
    return res.text();
  },
  validate: (text) => {
    assert.deepEqual(text, [
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

const sseLength = 20;
runBench("sseResponse", {
  opsPerSample: 100,
  fn: async () => {
    async function* generator() {
      let i = 0;
      while (i < sseLength) {
        yield { i };
        i++;
      }
    }
    const res = sseResponse(generator());
    return res.text();
  },
  validate: (text) => {
    const arr = Array.from({ length: sseLength }, (_, i) => `data: {"i":${i}}`);
    assert.deepEqual(text, arr.join("\n\n") + "\n\n");
  },
});
