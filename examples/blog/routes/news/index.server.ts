import { html, htmlToResponse } from "@mastrojs/mastro";
import { readMarkdownFiles } from "@mastrojs/markdown";
import { Layout } from "../../components/Layout.ts";

export const GET = async () => {
  const posts = await readMarkdownFiles("data/posts/*.md");
  return htmlToResponse(
    Layout({
      title: "News",
      children: posts.map((post) =>
        html`
          <p>
            <a href="${post.path.slice(12, -3) + "/"}">
              ${post.meta.title}
            </a>
          </p>
        `
      ),
    }),
  );
};
