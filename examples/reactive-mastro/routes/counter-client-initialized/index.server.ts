import { Layout } from "../../components/Layout.ts";
import { html, htmlToResponse } from "@mastrojs/mastro";

export const GET = () =>
  htmlToResponse(
    Layout({
      title: "Client-initialized counter example",
      children: html`
        <my-counter></my-counter>

        <script type="module" src="/counter.client.js"></script>
      `,
    }),
  );
