/**
 * This module exports a `fetch` handler that can be passed to Deno.serve,
 * or used directly with `deno serve`.
 * @module
 */

import tsBlankSpace from "ts-blank-space";
import { serveFile } from "@std/http/file-server";
import { toFileUrl } from "@std/path";
import { matchRoute } from "./router.ts";
import { jsResponse } from "./routes.ts";

const fetch = async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);

  try {
    const fileRes = await getStaticFile(req, pathname) ||
      await getStaticFile(req, pathname + ".html");
    if (fileRes) {
      if (pathname.endsWith(".client.ts")) {
        const text = await fileRes.text();
        return jsResponse(tsBlankSpace(text));
      } else {
        return fileRes;
      }
    } else {
      const route = matchRoute(req.url);
      if (route) {
        const modulePath = Deno.cwd() + route.filePath;
        const method = req.method.toUpperCase()
        console.info(`${method} ${req.url}, loading ${modulePath}`);
        const module = await import(toFileUrl(modulePath).toString());
        const handler = module[method]
        if (!handler) {
          throw Error(`No function ${method} exported by ${modulePath}`)
        }
        const res = await handler(req);
        if (res instanceof Response) {
          return res;
        } else {
          throw Error(method + " must return a Response object");
        }
      } else {
        return new Response("404 not found", { status: 404 });
      }
    }
  } catch (e: any) {
    if (pathname !== "/favicon.ico") {
      console.warn(e);
    }
    if (e.name === "NotFound" || e.code === 'ENOENT') {
      return new Response("404 not found", { status: 404 });
    } else {
      return new Response(`500: ${e.name || "Unknown error"}\n\n${e}`, { status: 500 });
    }
  }
};

/**
 * Default export with a `fetch` handler.
 * see [fetch handlers](https://blog.val.town/blog/the-api-we-forgot-to-name/)
 * and [Deno.ServeDefaultExport](https://docs.deno.com/api/deno/~/Deno.ServeDefaultExport)
 */
export default { fetch };

const getStaticFile = async (req: Request, path: string) => {
  const res = await serveFile(req, "routes" + path);
  return res.ok ? res : undefined;
};
