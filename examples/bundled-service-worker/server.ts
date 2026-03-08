import * as http from "node:http";
import { createRequestListener, type ClientAddress } from "@remix-run/node-fetch-server";
import { Mastro } from "@mastrojs/mastro/server-programmatic";
import * as Home from "./handlers/Home.ts";
import * as SW from "./handlers/SW.ts";
import * as SWConfig from "./handlers/SWConfig.ts";

// see https://mastrojs.github.io/docs/routing/#programmatic-router
export const handler = new Mastro<ClientAddress, void>()
  .get("/", Home)
  .get("/sw.js", SW)
  .get("/sw-version", SWConfig)
  .createHandler();

const port = 8000;

const server = http.createServer(createRequestListener(handler));

server.on("error", (e) => {
  console.error(e);
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
