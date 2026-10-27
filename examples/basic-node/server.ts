import { createServer } from "node:http";

import { createFileRouterApp } from "@mastrojs/mastro/server";
import { createRequestListener } from "@remix-run/node-fetch-server";

const port = 8000;

export const app = createFileRouterApp();

if (import.meta.main) {
  const server = createServer(createRequestListener(app.createHandler()));
  server.on("error", (e) => {
    console.error(e);
  });
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
