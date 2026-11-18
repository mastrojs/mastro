import { Mastro } from "@mastrojs/mastro";

import { routes } from "./.routes.ts";

// Cloudflare (`pnpm run dev` and in prod) serves pregenerated static files from the generated/ dir.
// But using `pnpm run start`, we can serve them directly from routes, for faster local development:
export const app: Mastro<[Env, ExecutionContext]> = navigator.userAgent === "Cloudflare-Workers"
  ? new Mastro({ routes })
  : await import("@mastrojs/mastro/server").then(m => m.createFileRouterApp(routes));


export default {
  fetch: app.createHandler(),
} satisfies ExportedHandler<Env>;
