import { getParams, htmlToResponse, readDir } from "@mastrojs/mastro";
import { Layout } from "../components/Layout.ts";

export const pregenerate = true;

export const handler = async (req: Request) => {
  const { slug } = getParams(req);

  // dynamic import to prevent markdown lib from being bundled into CF worker
  const { readMarkdownFile } = await import("@mastrojs/markdown");
  const post = await readMarkdownFile(`routes/posts/${slug}.md`);

  const { title } = post.meta;
  if (!title) throw Error(`No title in ${slug}`);
  return htmlToResponse(
    Layout({
      title,
      children: post.content,
    }),
  );
};

export const getStaticPaths = async () => {
  const posts = await readDir("routes/posts/");
  return posts.map((p) => "/posts/" + p.slice(0, -3) + "/");
};
