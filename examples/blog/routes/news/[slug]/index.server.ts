import { getParams, htmlToResponse, readDir } from "@mastrojs/mastro";
import { readMarkdownFile } from "@mastrojs/markdown";
import { Layout } from "../../../components/Layout.ts";

export const GET = async (req: Request) => {
  const { slug } = getParams(req);
  const post = await readMarkdownFile(`data/posts/${slug}.md`);
  return htmlToResponse(
    Layout({
      title: post.meta.title,
      children: post.content,
    }),
  );
};

export const getStaticPaths = async () => {
  const posts = await readDir("data/posts/");
  return posts.map((p) => "/news/" + p.slice(0, -3) + "/");
};
