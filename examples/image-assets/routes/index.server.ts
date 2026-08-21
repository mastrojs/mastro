import { asset, html, htmlToResponse } from "@mastrojs/mastro";

export const GET = () =>
  htmlToResponse(
    html`
      <!DOCTYPE html>
      <title>Images demo</title>

      <h1>Hi</h1>

      <img
        alt="Planet Earth"
        src=${asset("hero/blue-marble.jpg.webp")}
        >
    `
  );
