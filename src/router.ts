import { findFiles } from './fs.ts'

if (typeof URLPattern !== "function") {
  // implemented in Chrome, Deno and Node >=23.8.0
  // to be implemented by all browsers soon:
  // see https://wpt.fyi/results/urlpattern?q=label%3Ainterop-2025-urlpattern
  // should we add https://www.npmjs.com/package/urlpattern-polyfill in the mean-time?
  throw Error("Please use a browser that implements URLPattern")
}

export const paramRegex = /^\[([a-zA-Z0-9]+)\]/

const pathSegments = []
const suffix = typeof window === "object" ? "js" : "{ts,js}"
for (const filePath of await findFiles(`routes/**/*.server.${suffix}`)) {
  const segments = filePath.split('/').slice(2).map(segment => {
    const param = segment.match(paramRegex)?.[1]
    if (param) {
      return ':' + param
    } else if (segment === 'index.server.ts' || segment === 'index.server.js') {
      return
    } else if (segment.endsWith('.server.ts') || segment.endsWith('.server.js')) {
      return segment.slice(0, -10)
    } else {
      return segment
    }
  }).filter(s => s)
  pathSegments.push({ filePath, segments })
}

// TODO: sort this according to solid route precedence criteria
pathSegments.sort((a, b) => a.segments.length - b.segments.length)

export const routes = pathSegments.map(r => {
  const route = {
    filePath: r.filePath,
    pattern: new URLPattern({ pathname: `/${r.segments.join('/')}` }),
  };
  Object.freeze(route);
  return route;
})
Object.freeze(routes)

export const matchRoute = (urlPath: string) => {
  for (const route of routes) {
    const match = route.pattern.exec(urlPath)
    if (match) {
      const { filePath } = route
      if (typeof window === 'object' && filePath.endsWith(".server.ts")) {
        throw Error(
          "TypeScript files are currently not supported in the " +
          ` Mastro VSCode extension (${filePath})`
        )
      }
      return {
        filePath,
        params: match.pathname.groups || {}
      }
    }
  }
}

export const getParams = (urlPath: string) =>
  matchRoute(urlPath)?.params || {}
