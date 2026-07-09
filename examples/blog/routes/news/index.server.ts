import { html, htmlToResponse } from "@mastrojs/mastro";
import { readMarkdownFiles } from "@mastrojs/markdown";
import { Layout } from "../../components/Layout.ts";

export const GET = async () => {
  // see https://github.com/mastrojs/markdown for config options
  const posts = await readMarkdownFiles<{title: string}>("data/posts/*.md");

  return htmlToResponse(
    Layout({
      title: "News",
      children: posts.reverse().map((post) =>
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
