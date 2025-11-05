import { Layout } from "../components/Layout.ts";
import { html, htmlToResponse } from "@mastrojs/mastro";

export const GET = () =>
  htmlToResponse(
    Layout({
      title: "Kitchen Sink example",
      children: html`
        <tab-switch></tab-switch>

        <script type="module" src="/x-kitchen-sink.client.js"></script>
        `,
    }),
  );
