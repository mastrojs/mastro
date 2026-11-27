// Benchmark helper file:
// needs to be in src for TypeScript to find it, filename
// needs to match *.bench.* for prepack to exclude it.

//@ts-expect-error node:bench is only defined in types for node v27
import { bench } from "node:bench";

import { type Html, html } from "./core/html.ts";
import { htmlToResponse } from "./core/responses.ts";

interface RunBenchOpts<T> {
  /** function to be benchmarked */
  fn: () => Promise<T>;
  /** put assertions in here, because this runs after benchmarking */
  validate?: (result: T) => void;
  /**
   * defaults to 1, increase if the benchmark is cheap to run
   * and you want to increase measurement quality
   */
  opsPerSample?: number;
}

/**
 * Minimal wrapper around https://nodejs.org/api/bench.html
 */
export const runBench = <T>(
  name: string,
  { fn, validate, opsPerSample = 1 }: RunBenchOpts<T>,
): ReturnType<bench> =>
  bench(name, { samples: 30 }, async (b: any) => {
    const results = new Array<T>(opsPerSample);
    b.start();
    for (let i = 0; i < opsPerSample; i++) {
      results[i] = await fn();
    }
    b.end(opsPerSample);
    if (validate) {
      for (const result of results) validate(result);
    }
  });

/** Setup a few relatively realistic components for response and generator benchmarks. */
export const title = "Hello World";
const favicon = "/favicon.ico";
const Menu = () =>
  html`
    <nav>
      <ul></ul>
    </nav>
  `;

export const Layout = (props: { children: Html; title: string }): Html =>
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

export async function* widgetsIterable(): AsyncGenerator<Html> {
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
