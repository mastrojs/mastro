import { createFileRouterApp } from "@mastrojs/mastro/server";
import { FastResponse, serve } from "srvx";

export const app = createFileRouterApp();

if (import.meta.main) {
  globalThis.Response = FastResponse; // see https://srvx.h3.dev/guide/node
  serve({ fetch: app.createHandler() });
}
