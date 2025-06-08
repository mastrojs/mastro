import { type Html, readDir, readMarkdownFile } from 'mastro'

export interface Post {
  content: Html;
  meta: Record<string, string>;
  slug: string;
}

export const getPost = async (slug: string): Promise<Post> => {
  const { content, meta } = await readMarkdownFile(`./data/posts/${slug}.md`)
  return {
    content,
    meta,
    slug,
  }
}

export const getPosts = async () => {
  const slugs = await getPostSlugs()
  return Promise.all(slugs.map(getPost))
}

export const getPostSlugs = async () =>
  (await readDir('./data/posts')).map(name => name.replace('.md', ''))
