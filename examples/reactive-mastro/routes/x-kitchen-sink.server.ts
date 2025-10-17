import { Layout } from "../components/Layout.ts";
import { html, htmlResponse, renderToStream } from "@mastrojs/mastro";

export const GET = () =>
  htmlResponse(renderToStream(
    Layout({
      title: "Kitchen Sink example",
      children: html`
        <tab-switch></tab-switch>

        <script type="module" src="/x-kitchen-sink.client.js"></script>
        `,
    }),
  ));
