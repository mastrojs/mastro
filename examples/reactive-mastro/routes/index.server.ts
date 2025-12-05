import { Layout } from "../components/Layout.ts";
import { findFiles, html, htmlToResponse } from "@mastrojs/mastro";

export const GET = async (): Promise<Response> => {
  const title = "Reactive Mastro demos";

  const examples = (await findFiles("routes/**/*.server.ts"))
    .flatMap((name) =>
      name === "/routes/index.server.ts" ? [] : name.slice(8, -16)
    )
    .sort();

  return htmlToResponse(
    Layout({
      title,
      children: html`
        <h1>${title}</h1>
        <ul>
          ${examples.map((ex) =>
            html`
              <li><p><a href="${ex + "/"}">${ex}</a></p></li>
            `
          )}
        </ul>
      `,
    }),
  );
};
