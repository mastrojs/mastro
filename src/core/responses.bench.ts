import { Layout } from "../../examples/blog/components/layout/Layout.ts";
import { html } from "./html.ts";
import { htmlToResponse } from "./responses.ts";

const title = "Hello World";

const widgets = [
  { title: "foo" },
  { title: "foo" },
  { title: "foo" },
  { title: "foo" },
  { title: "foo" },
];

const nodes = Layout({
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
});

Deno.bench({
  name: "htmlToResponse",
  async fn() {
    const res = htmlToResponse(nodes);
    await res.text();
  },
});
