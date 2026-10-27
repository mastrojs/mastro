import { type Html, html } from "@mastrojs/mastro";

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
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <h1>${props.title}</h1>
        ${props.children}
      </body>
    </html>
  `;
