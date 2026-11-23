import { createApp } from "@mastrojs/mastro/server";
import { FastResponse, serve } from "srvx";

import * as Home from "./handlers/Home.ts";
import * as SW from "./handlers/SW.ts";
import * as SWConfig from "./handlers/SWConfig.ts";

// see https://mastrojs.github.io/docs/routing/#programmatic-router
export const app = createApp()
  .get("/", Home)
  .get("/sw.js", SW)
  .get("/sw-config", SWConfig);

if (import.meta.main) {
  globalThis.Response = FastResponse; // see https://srvx.h3.dev/guide/node
  serve({ fetch: app.createHandler() });
}
