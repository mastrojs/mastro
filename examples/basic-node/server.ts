import { createServer } from "node:http";

import { createFileRouterApp } from "@mastrojs/mastro/server";
import { createRequestListener } from "@remix-run/node-fetch-server";

const port = process.env.PORT || 8000;

export const app = createFileRouterApp();

if (import.meta.main) {
  createServer(createRequestListener(app.createHandler())).listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
