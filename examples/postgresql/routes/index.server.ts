import { html, htmlToResponse } from "@mastrojs/mastro";
import { Layout } from "../components/Layout.ts";
import { db } from "../db/db.ts";
import { mapIterable } from "../db/iterable.ts";

export const GET = (_req: Request) => {
  const rows = db
    .selectFrom("person")
    .select(["first_name"])
    .where("gender", "=", "woman")
    .stream();
  return htmlToResponse(
    Layout({
      title: "Hello World",
      children: html`
        <p>Welcome!</p>
        <ul>
          ${mapIterable(rows, (row) => html`<li>${row.first_name}</li>`)}
        </ul>
      `,
    }),
  );
};
