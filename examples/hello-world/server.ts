import { createServer } from "node:http";
import { createRequestListener } from "@remix-run/node-fetch-server";
import { createFileRouterApp } from "@mastrojs/mastro/server";

const port = 8000;

const server = createServer(createRequestListener(createFileRouterApp().createHandler()));

server.on("error", (e) => {
  console.error(e);
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
