import { html, htmlToResponse } from "@mastrojs/mastro";
import { Layout } from "../components/Layout.ts";

export const pregenerate = true;

export const handler = () => {
  return htmlToResponse(
    Layout({
      title: "Home",
      children: html`<a href="/posts/2025-01-22-hello-world/">First post</a>`,
    }),
  );
};
