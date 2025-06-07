import { Layout } from "../components/layout/Layout.ts"
import { html, renderToString } from "mastro/html.ts"
import { htmlResponse } from "mastro/routes.ts"
import { getPost, getPostSlugs } from "../models/posts.ts"

export const GET = async (req: Request): Promise<Response> => {
  const post = await getPost(new URL(req.url).pathname)
  const title = post.meta.title + ' | My blog'
  return htmlResponse(
    await renderToString(
      Layout({
        title,
        children: html`
          <article>
            <h2>${post.meta.title}</h2>
            <p>${post.content}</p>
          </article>
          `
      }),
    )
  )
}

export const getStaticPaths = async () => {
  const slugs = await getPostSlugs()
  return slugs.map(p => '/' + p)
}
