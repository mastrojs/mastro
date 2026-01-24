import { ghPagesBasePath, html, type Html } from "@mastrojs/mastro";
import { Header } from "./Header.ts";
import { Footer } from "./Footer.ts";

export const basePath = ghPagesBasePath();

interface Props {
  title?: string;
  children: Html;
}

export const Layout = (props: Props) =>
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
