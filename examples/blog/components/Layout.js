import { ghPagesBasePath, html } from "@mastrojs/mastro";
import { Header } from "./Header.js";
import { Footer } from "./Footer.js";

export const basePath = ghPagesBasePath();

export const Layout = (props) =>
  html`
    <!doctype html>
    <html lang="en">
      <head>
        <title>${props.title}</title>
        <link rel="stylesheet" href=${basePath + "/styles.css"}>
        <meta name="viewport" content="width=device-width">
      </head>
      <body>
        ${Header()}

        <main>
          ${props.children}
        </main>

        ${Footer()}
      </body>
    </html>
  `;
