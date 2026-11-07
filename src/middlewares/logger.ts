import type { Middleware } from "../middleware.ts";

/** Basic logging middleware. Place this first in the middleware stack. */
export const logger: Middleware = {
  name: "logger",
  handler: async (req, ctx) => {
    const { method, url } = req;
    const res = await ctx.fetchUpstream(req);
    const { status } = res;
    if (status < 400) {
      if (ctx.mode === "server" && ctx.environment === "development") {
        log("info", method, url, status, "routeName" in res ? res.routeName : "");
      }
    } else {
      const isDev = ctx.mode === "generator" || ctx.environment === "development";
      const e = "error" in res ? (res.error as any) : "";

      if (e?.name === "NotFound" || e?.code === "ENOENT") {
        // this is mainly for the functions in core/fs.ts: move this to the catch in middleware.ts ?
        log("warn", method, url, 404, e);
        return new Response(`404 Not Found\n\n${isDev ? e.message : ""}`, { status: 404 });
      }

      if (isDev) {
        const urlObj = new URL(url);
        if (urlObj.pathname === "/favicon.ico" && status == 404) return res;
        log(status >= 500 ? "error" : "warn", method, urlObj, status, e);
        if ("error" in res) return new Response(`${await res.text()}\n\n${e?.stack || e}`, res);
      } else if (status >= 500) {
        const message = String(e) || `HTTP ${status}`;
        console.error(JSON.stringify({ method, url, status, message, stack: e?.stack }));
      }
    }
    return res;
  },
};

const log = (level: "error" | "warn" | "info", method: string, url: URL | string, status: number, e: unknown) => {
  const u = typeof url === "string" ? new URL(url) : url;
  const [ansiStart, ansiReset] = level === "info" ? ["", ""] : ["\x1b[35m", "\x1b[0m"];
  console[level](`${ansiStart}${method} ${u.pathname + u.search} => ${status}${ansiReset}`, e);
}
