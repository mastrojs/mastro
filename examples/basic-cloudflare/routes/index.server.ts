import { html, htmlToResponse } from "@mastrojs/mastro";
import { Layout } from "../components/Layout.ts";

export const GET = (req: Request) =>
  htmlToResponse(
    Layout({
      title: "Hello World",
      children: html`
        <p>Welcome to ${req.url}</p>
      `,
    }),
  );
