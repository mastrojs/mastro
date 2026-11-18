import { createServer } from "node:http";

import { createApp } from "@mastrojs/mastro/server";
import { createRequestListener, type ClientAddress } from "@remix-run/node-fetch-server";

import * as Home from "./handlers/Home.ts";
import * as SW from "./handlers/SW.ts";
import * as SWConfig from "./handlers/SWConfig.ts";

// see https://mastrojs.github.io/docs/routing/#programmatic-router
export const app = createApp<[ClientAddress]>()
  .get("/", Home)
  .get("/sw.js", SW)
  .get("/sw-config", SWConfig);

const port = process.env.PORT || 8000;

if (import.meta.main) {
  createServer(createRequestListener(app.createHandler())).listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
