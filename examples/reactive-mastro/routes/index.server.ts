import { Layout } from "../components/Layout.ts";
import { html, htmlToResponse, readDir } from "mastro";

export const GET = async (): Promise<Response> => {
  const title = "Reactive Mastro demos";

  const examples = (await readDir("routes"))
    .filter((name) => name.endsWith(".server.ts") && name !== "index.server.ts")
    .map((name) => name.slice(0, -10))
    .toSorted((a, b) => a > b ? 1 : -1);

  return htmlToResponse(
    Layout({
      title,
      children: html`
        <h1>${title}</h1>
        <ul>
          ${examples.map((ex) =>
          html`
            <li><p><a href="${ex}/">${ex}</a></p></li>
          `
        )}
        </ul>
      `,
    }),
  );
};
