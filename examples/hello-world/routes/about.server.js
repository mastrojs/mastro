import { Layout } from "../components/Layout.js";
import { html, htmlToResponse } from "mastro";

export const GET = () =>
  htmlToResponse(
    Layout({
      title: "About us",
      children: html`
        <p>About us</p>
      `,
    }),
  );
