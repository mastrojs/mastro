import { type Html, html } from "@mastrojs/mastro";
import { Menu } from "./Menu.ts";

interface Props {
  children: Html;
  title: string;
}

export const Layout = (props: Props) =>
  html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${props.title}</title>
        <link rel="icon" href="${favicon}">
      </head>
      <body>
        ${Menu()}
        <main>${props.children}</main>
      </body>
    </html>
  `;

const favicon = "data:image/svg+xml," + encodeURI([
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>",
  "<text y='.9em' font-size='90'>👨‍🍳</text>",
  "</svg>",
].join(""));
