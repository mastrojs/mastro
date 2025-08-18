import { type Html, html } from "mastro";

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
        <meta name='viewport' content='width=device-width'>
        <title>Reactive Mastro ${props.title}</title>
        <script type="importmap">
          {
            "imports": {
              "mastro/reactive": "https://esm.sh/jsr/@mastrojs/mastro@0.1.3/reactive?bundle"
            }
          }
        </script>
        <link rel="icon" href=${favicon}>
        <style>
          html, body {
            font-family: monospace;
            padding: 1em 5vw;
          }
          main {
            max-width: 40em;
          }
          h1 {
            margin-bottom: 2em;
          }
          ol, ul {
            padding-left: 0;
          }
          li {
            list-style-type: none;
          }
          .hidden {
            display: none;
          }
        </style>
      </head>
      <body>
        ${props.title.endsWith(' example')
          ? html`
            <p>← <a href="..">Reactive Mastro examples</a></p>
            <h1>${props.title}</h1>
            `
          : ''}
        <main>${props.children}</main>
      </body>
    </html>
    `

const favicon = 'data:image/svg+xml,' + encodeURI([
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>",
  "<text y='.9em' font-size='90'>👨‍🍳</text>",
  "</svg>"
].join(""))
