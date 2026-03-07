import * as http from "node:http";
import { createRequestListener } from "@remix-run/node-fetch-server";
import mastro from "@mastrojs/mastro/server";

const port = 8000;

const server = http.createServer(createRequestListener(mastro.fetch));

server.on("error", (e) => {
  console.error(e);
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
