import { Mastro } from "@mastrojs/mastro";

import * as Home from "./handlers/Home.ts";

// Cloudflare (`pnpm run dev` and in prod) serves pregenerated static files from the generated/ dir.
// But using `pnpm run start`, we can serve them directly from routes, for faster local development:
const { middlewares } =
  navigator.userAgent === "Cloudflare-Workers" ? {} : await import("../../src/servers/server.ts");

export const app = new Mastro<[Env, ExecutionContext]>({ middlewares })
  .get("/", Home)
  .get("/text/", (req, env, ctx) => new Response("Here is some plain text"));
// Add more routes here, see https://mastrojs.github.io/docs/routing/#programmatic-router

export default {
  fetch: app.createHandler(),
} satisfies ExportedHandler<Env>;
