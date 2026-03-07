import { html, htmlToResponse } from "@mastrojs/mastro";
import { Layout } from "../components/Layout.ts";

export const handler = (req: Request) =>
  htmlToResponse(
    Layout({
      title: "Hello World from the Service Worker!",
      children: html`
        <p>Welcome to ${req.url}</p>
      `,
    }),
  );
