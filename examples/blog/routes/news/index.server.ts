import { html, htmlToResponse } from "@mastrojs/mastro";
import { readMarkdownFiles } from "@mastrojs/markdown";
import { Layout } from "../../components/Layout.ts";

export const GET = async () => {
  // to actually verify the metadata, use a schema: https://github.com/mastrojs/markdown#schema
  const posts = await readMarkdownFiles<{title: string}>("data/posts/*.md");

  return htmlToResponse(
    Layout({
      title: "News",
      children: posts.map((post) =>
        html`
          <p>
            <a href="${post.slug + "/"}">
              ${post.meta.title}
            </a>
          </p>
        `
      ),
    }),
  );
};
