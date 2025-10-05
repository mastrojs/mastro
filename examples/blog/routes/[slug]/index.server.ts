import { Layout } from "../../components/layout/Layout.ts";
import { html, htmlToResponse } from "@mastrojs/mastro";
import { getPost, getPostSlugs } from "../../models/posts.ts";

export const GET = async (req: Request): Promise<Response> => {
  console.log(req.url);
  const post = await getPost(new URL(req.url).pathname);
  const title = post.meta.title + " | My blog";
  return htmlToResponse(
    Layout({
      title,
      children: html`
        <article>
          <h2>${post.meta.title}</h2>
          <p>${post.content}</p>
        </article>
      `,
    }),
  );
};

export const getStaticPaths = async () => {
  const slugs = await getPostSlugs();
  return slugs.map((p) => "/" + p);
};
