import { Mastro } from '@mastrojs/mastro/server'
import * as Home from './handlers/Home.ts';
import * as PostDetail from './handlers/PostDetail.ts';

export const app = new Mastro<Env, ExecutionContext>()
  .get("/", Home)
  .get("/posts/:slug/", navigator.userAgent === "Cloudflare-Workers"
    ? (req, env) => {
        const mediaType = req.headers.get("accept")?.split(",").find(val => val.startsWith("text/"));
        const suffix = mediaType === "text/html" ? "" : ".md";
        const url = req.url.slice(0, -1) + suffix;
        return env.ASSETS.fetch(new Request(url));
    }
    : PostDetail
  )

// wrangler is configured to serve pregenerated static files from the generated folder
// but with Deno, Mastro serves them directly from routes:
//@ts-expect-error Deno not found
const serveStaticFiles = typeof Deno === "object";

export default {
  fetch: app.createHandler({ serveStaticFiles }),
} satisfies ExportedHandler<Env>;
