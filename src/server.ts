import tsBlankSpace from 'ts-blank-space'
import { serveFile } from "@std/http/file-server"
import { join, toFileUrl } from '@std/path'
import { matchRoute } from './router.ts'
import { jsResponse } from './routes.ts'
import { readTextFile } from './fs.ts'

export const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  const { pathname } = url

  try {
    if (pathname.endsWith('.client.ts')) {
      const prefix = pathname.startsWith('/components/') ? '' : 'routes/'
      const text = await readTextFile(prefix + pathname.slice(1))
      return jsResponse(tsBlankSpace(text))
    } else if (pathname.startsWith('/client/mastro/')) {
      const filePath = import.meta.resolve(pathname.slice('/client/'.length)).slice('file://'.length)
      const text = await readTextFile(filePath)
      return jsResponse(tsBlankSpace(text))
    } else if (pathname.startsWith('/client/')) {
      const specifier = import.meta.resolve(pathname.slice('/client/'.length))
      const str = await loadDependency(specifier)
      return jsResponse(str)
    } else {
      const fileRes = await getStaticFile(req, pathname) || await getStaticFile(req, pathname + ".html")
      if (fileRes) {
        return fileRes
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

const loadDependency = async (specifier: string) => {
  // TODO: perhaps instead of `nodeModulesDir` in deno.json
  // we could load files from ~/Library/Caches/deno/ (Deno.cacheDir),
  // maybe use https://jsr.io/@deno/cache-dir

  const { pathname, protocol } = new URL(specifier)
  if (protocol === 'npm:') {
    const [module, path] = pathname.split(/@\d+\.\d+\.\d+/)

    // TEMP hack: because cwd is e.g. /examples/blog/
    const prefix = '../..'

    const moduleDir = `${prefix}/node_modules/${module}`
    const pkg = JSON.parse(await readTextFile(`${moduleDir}/package.json`))

    // TODO: also support https://nodejs.org/api/packages.html#main
    // see https://nodejs.org/api/packages.html#exports
    const entryPoint = pkg.exports['.'].default

    const filePath = path === '/'
      ? join(moduleDir, entryPoint)
      : join(moduleDir, entryPoint, path).replaceAll('index.js/', '')

    return readTextFile(filePath)
  } else {
    throw Error('TODO: implement deno module resolution')
  }
}
