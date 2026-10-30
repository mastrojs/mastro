import { createFileRouterApp } from "@mastrojs/mastro/server";

export const app = createFileRouterApp();

if (import.meta.main) {
  const port = 8000;
  Bun.serve({
    port,
    fetch: app.createHandler(),
  });

  console.log(`Server running at http://localhost:${port}`);
}
