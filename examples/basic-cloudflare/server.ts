import { Mastro } from "@mastrojs/mastro";

import { routes } from "./.routes.ts";

// Cloudflare (`pnpm run dev` and in prod) serves pregenerated static files from the generated/ dir.
// But using `pnpm run start`, we can serve them directly from routes, for faster local development:
const { middlewares } =
  navigator.userAgent === "Cloudflare-Workers" ? {} : await import("../../src/servers/server.ts");

export const app = new Mastro({ middlewares, routes });

export default {
  fetch: app.createHandler(),
} satisfies ExportedHandler<Env>;
