import { Layout } from "../components/Layout.ts";
import { html, htmlResponse, renderToStream } from "mastro";

export const GET = () =>
  htmlResponse(renderToStream(
    Layout({
      title: "Client-initialized counter example",
      children: html`
        <my-counter></my-counter>

        <script type="module" src="counter.client.ts"></script>
        `,
    }),
  ));
