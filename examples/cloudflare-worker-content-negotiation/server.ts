import { Mastro } from "@mastrojs/mastro";

import * as Home from "./handlers/Home.ts";
import * as PostDetail from "./handlers/PostDetail.ts";

export const app: Mastro<[Env, ExecutionContext]> = navigator.userAgent === "Cloudflare-Workers"
  ? new Mastro()
  : await import("@mastrojs/mastro/server").then(m => m.createApp());

app.get("/", Home).get(
  "/posts/:slug/",
  navigator.userAgent === "Cloudflare-Workers"
    ? (req, { extras: [env] }) => {
        const mediaType = req.headers
          .get("accept")
          ?.split(",")
          .find((val) => val.startsWith("text/"));
        const suffix = mediaType === "text/html" ? "" : ".md";
        const url = req.url.slice(0, -1) + suffix;
        return env.ASSETS.fetch(new Request(url));
      }
    : PostDetail,
);

export default {
  fetch: app.createHandler(),
} satisfies ExportedHandler<Env>;
