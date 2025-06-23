import tsBlankSpace from 'ts-blank-space'
import { serveFile } from "@std/http/file-server"
import { toFileUrl } from '@std/path'
import { matchRoute } from './router.ts'
import { jsResponse } from './routes.ts'

export const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  const { pathname } = url

  try {
      const fileRes = await getStaticFile(req, pathname) || await getStaticFile(req, pathname + ".html")
      if (fileRes) {
        if (pathname.endsWith('.client.ts')) {
          const text = await fileRes.text()
          return jsResponse(tsBlankSpace(text))
        } else {
          return fileRes
        }
      } else {
        const route = matchRoute(req.url)
        if (route) {
          const modulePath = Deno.cwd() + route.filePath
          console.info(`Received ${req.url}, loading ${modulePath}`)
          const { GET } = await import(toFileUrl(modulePath).toString())
          const res = await GET(req)
          if (res instanceof Response) {
            return res
          } else {
            throw Error('GET must return a Response object')
          }
        } else {
          return new Response('404 not found', { status: 404 })
      }
    }
  } catch (e: any) {
    if (pathname !== '/favicon.ico') {
      console.warn(e)
    }
    if (e.name === 'NotFound') {
      return new Response('404 not found', { status: 404 })
    } else {
      return new Response(`500: ${e.name || 'Unknown error'}\n\n${e}`, { status: 500 })
    }
  }
}

const getStaticFile = async (req: Request, path: string) => {
  const res = await serveFile(req, 'routes' + path)
  return res.ok ? res : undefined
}
